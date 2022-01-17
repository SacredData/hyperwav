const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('.')

const source = new Source('./test.wav')
source.open(() => {
  console.log('opened source WAV file', source)
  async function main() {
    const w = new Wavecore({ source })
    console.log('creating new hypercore...')
    await w.toHypercore({loadSamples:true})
    console.log('wave file metadata:', JSON.parse(`${await w.core.get(0)}`))
  }
  main()
})
