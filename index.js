const fs = require('fs')
const Hypercore = require('hypercore')
const { PassThrough } = require('stream')
const ram = require('random-access-memory')
const { Source } = require('@storyboard-fm/little-media-box')
const WaveFile = require('wavefile').WaveFile

class Wavecore {
  constructor(source, opts={core:null,storage:ram}) {
    this.core = null
    this.source = null
    // Instantiate stream for appending WAV file data to hypercore
    if (source instanceof Source) source.open(() => this.source = source)
    // Assign to a hypercore provided via constructor arguments
    if (opts.core instanceof Hypercore) this.core = core
    // Declaring a specific storage supercedes defining a specific hypercore
    if (opts.storage) this.core = new Hypercore(opts.storage)
    // If there is still no hypercore lets just make a sane default one
    if (!this.core) this.core = new Hypercore(ram)
    this.core.on('ready', () => console.log('core is ready!', this.core.keyPair))
  }
  async _toHypercore() {
    await this.core.ready()

    const pt = new PassThrough()
    pt.on('data', (d) => this.core.append(d))

    const rs = fs.createReadStream(this.source.pathname)
    rs.on('end', () => console.log(this.core))

    // Get WAV metadata and headers for index 0 of our hypercore
    const wavfile = new WaveFile()
    wavfile.fromBuffer(await this._audioBuffer())

    // Grab useful metadata from the wavfile object to append
    const { chunkSize, cue, fmt, smpl, tags } = wavfile
    this.core.append(JSON.stringify(
      Object.assign({ chunkSize, cue, fmt, smpl, tags }, {}))
    )

    rs.pipe(pt)
  }
  async _audioBuffer() {
    return fs.readFileSync(this.source.pathname)
  }
}

module.exports = Wavecore
