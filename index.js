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
  constructor(source, opts = { core: null, storage: ram }) {
    this.core = null
    this.source = null
    // Instantiate stream for appending WAV file data to hypercore
    if (source instanceof Source) this.source = source
    // Assign to a hypercore provided via constructor arguments
    if (opts.core instanceof Hypercore) this.core = core
    // Declaring a specific storage supercedes defining a specific hypercore
    if (opts.storage)
      this.core = new Hypercore(opts.storage, Wavecore.coreOpts())
    // If there is still no hypercore lets just make a sane default one
    if (!this.core) this.core = new Hypercore(ram, Wavecore.coreOpts())
    this.core.on('ready', () =>
      console.log('core is ready!', this.core.keyPair)
    )
  }
  async _toHypercore(opts = { loadSamples: false }) {
    const { loadSamples } = opts
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

      // PassThrough will append each block received from readStream to hypercore
      const pt = new PassThrough()
      pt.on('data', async (d) => await this.core.append(d))
      pt.on('close', async () => {
        await this.core.update()
        return this.core
      })

      const rs = fs.createReadStream(this.source.pathname)
      rs.on('end', () => console.log(this.core))

      await this.core.append(
        JSON.stringify(
          Object.assign({ chunkSize, cue, fmt, smpl, tags }, probe)
        )
      )

      rs.pipe(pt)
    } catch (err) {
      throw err
    }
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
      this.source.probe((err, results) => {
        if (err) reject(err)
        resolve(results)
      })
    })
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
