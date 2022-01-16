const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('.')

const s = new Source('./test.wav')
s.open(() => {
  console.log('opened source WAV file', s)
  async function main() {
    const w = new Wavecore(s)
    console.log('creating new hypercore...')
    await w._toHypercore()
    console.log('wave file metadata:', JSON.parse(`${await w.core.get(0)}`))
  }
  main()
})
