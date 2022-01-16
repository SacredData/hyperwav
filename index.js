const Hypercore = require('hypercore')
const { Source } = require('@storyboard-fm/little-media-box')

class Wavecore {
  constructor(source) {
    if (source instanceof Source) source.open(() => this.source = source)
  }
}

module.exports = Wavecore
