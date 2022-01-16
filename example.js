const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('.')

const s = new Source('./test.wav')
s.open(() => {
  async function main() {
    const w = new Wavecore(s)

    await w._toHypercore()
    console.log(w.core)
  }
  main()
})
