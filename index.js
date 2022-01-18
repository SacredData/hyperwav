const fs = require('fs')
const Hypercore = require('hypercore')
const { PassThrough } = require('stream')
const ram = require('random-access-memory')
const { Source } = require('@storyboard-fm/little-media-box')
const WaveFile = require('wavefile').WaveFile

class Wavecore {
  static coreOpts() {
    return { valueEncoding: 'binary', overwrite: false, createIfMissing: true }
  }
  constructor(opts = { core: null, source: null, storage: ram }) {
    this.core = null
    this.source = null
    const { core, source } = opts
    // Instantiate stream for appending WAV file data to hypercore
    if (source instanceof Source) this.source = source
    // Assign to a hypercore provided via constructor arguments
    if (core instanceof Hypercore) this.core = core
    // Declaring a specific storage supercedes defining a specific hypercore
    if (opts.storage)
      this.core = new Hypercore(opts.storage, Wavecore.coreOpts())
    // If there is still no hypercore lets just make a sane default one
    if (!this.core) this.core = new Hypercore(ram, Wavecore.coreOpts())
    this.core.on('ready', () =>
      console.log('core is ready!', this.core.keyPair)
    )
  }
  _audioBuffer() {
    return new Promise((resolve, reject) => {
      if (!this.source) reject(new Error('Add a source first'))
      this.source.open((err) => {
        if (err) reject(err)
        resolve(fs.readFileSync(this.source.pathname))
      })
    })
  }
  _probeSource() {
    return new Promise((resolve, reject) => {
      this.source.open((err) => {
        if (err) reject(err)
        this.source.probe((err, results) => {
          if (err) reject(err)
          resolve(results)
        })
      })
    })
  }
  _wavStream(start = 1, end = -1) {
    try {
      return this.core.createReadStream({ start, end })
    } catch (err) {
      throw err
    }
  }
  async formatData() {
    try {
      const { format } = json.parse(`${await this.core.get(0)}`)
      this.format = format
      return this.format
    } catch (err) {
      throw err
    }
  }
  async seek(byteOffset) {
    const [index, relativeOffset] = await this.core.seek(byteOffset)
    return [index, relativeOffset]
  }
  async toHypercore(opts = { loadSamples: false, source: null }) {
    const { loadSamples, source } = opts
    if (source instanceof Source) this.source = source
    try {
      // Before we append to index 0 we'll probe the source for more data
      const probe = await Promise.resolve(this._probeSource())

      // If that Source ain't a WAV we gotta send it back
      if (probe.format.format_name !== 'wav') throw new Error('Not a WAV!')

      // Get WAV metadata and headers for index 0 of our hypercore
      const wavfile = new WaveFile()
      wavfile.fromBuffer(await this._audioBuffer(), loadSamples)

      // Grab useful metadata from the wavfile object to append
      const { chunkSize, cue, fmt, smpl, tags } = wavfile

      await this.core.ready()

      return new Promise((resolve, reject) => {
        // PassThrough will append each block received from readStream to hypercore
        const pt = new PassThrough()
        // pt.on('data', async (d) => await this.core.append(d))
        pt.on('data', (d) => this.core.append(d))
        pt.on('close', async () => {
          console.log(await this.core.update())
        })

        const rs = fs.createReadStream(this.source.pathname)
        rs.on('end', () => resolve(this.core))
        rs.on('error', (err) => reject(err))

        this.core
          .append(
            JSON.stringify(
              Object.assign({ chunkSize, cue, fmt, smpl, tags }, probe)
            )
          )
          .then(() => rs.pipe(pt))
          .catch((err) => reject(err))
      })
    } catch (err) {
      throw err
    }
  }
  async truncate(length) {
    if (!length || !length instanceof Number) return
    if (length > this.core.length) throw new Error('Must be a shorter length')
    return await this.core.truncate(length)
  }
  async streamData() {
    try {
      const { streams } = JSON.parse(`${await this.core.get(0)}`)
      this.streams = streams
      return this.streams[0]
    } catch (err) {
      throw err
    }
  }
}

module.exports = Wavecore
