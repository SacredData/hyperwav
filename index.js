const Hypercore = require('hypercore')
const { PassThrough } = require('stream')
const ram = require('random-access-memory')
const { Source } = require('@storyboard-fm/little-media-box')

class Wavecore {
  constructor(source) {
    if (source instanceof Source) source.open(() => this.source = source)
    this.core = new Hypercore(ram)
    this.pt = new PassThrough()
    this.pt.on('data', async (d) => await this.core.append(d))
  }
  async _toHypercore() {
    await this.core.ready()
    const rs = fs.createReadStream(this.source.pathname)
    rs.on('end', () => console.log('reading ended'))
    rs.on('close', () => { return this.core })
    rs.pipe(this.pt)
  }
}

module.exports = Wavecore
