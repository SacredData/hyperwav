const fs = require('fs')
const Hypercore = require('hypercore')
const { PassThrough } = require('stream')
const ram = require('random-access-memory')
const { Source } = require('@storyboard-fm/little-media-box')
const WaveFile = require('wavefile').WaveFile

class Wavecore {
  constructor(source) {
    if (source instanceof Source) source.open(() => this.source = source)
    this.core = new Hypercore(ram)
    this.core.on('append', () => console.log('core appended!'))
    this.pt = new PassThrough()
    this.pt.on('data', (d) => this.core.append(d))
  }
  async _toHypercore() {
    await this.core.ready()
    const rs = fs.createReadStream(this.source.pathname)
    rs.on('end', () => console.log('reading ended', this.core))

    // Get WAV metadata and headers for index 0 of our hypercore
    const wavfile = new WaveFile()
    wavfile.fromBuffer(await this._audioBuffer())
    const { chunkSize, cue, fmt, smpl, tags } = wavfile
    this.core.append(JSON.stringify(
      Object.assign({ chunkSize, cue, fmt, smpl, tags }, {}))
    )

    rs.pipe(this.pt)
  }
  async _audioBuffer() {
    return fs.readFileSync(this.source.pathname)
  }
}

module.exports = Wavecore
