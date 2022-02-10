const fs = require('fs')
const path = require('path')
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('..')

const source = new Source(path.join(__dirname, '..', 'test', 'test.wav'))
source.open(async () => {
  console.log('opened source WAV file', source)
  async function main() {
    const w = new Wavecore({ source })
    console.log(w.core)
    console.log('appending to hypercore...')
    await w.toHypercore({loadSamples:true})
    console.log('done', w.core)
    console.log('lets cut it down to 12 sec or so')
    await w.truncate(15)
    await w.core.update()
    console.log('done')
    console.log('the hypercore is smaller now', w.core)
    console.log('he is going to end on the sentence "I HATE THIS."')
    return w.play()
    /*
    console.log('lets write the shorter file to disk...')
    w._rawStream().pipe(
      fs.createWriteStream('shorter-test.raw')
      .on('close', () => console.log('done writing'))
    )
    return
    */
  }
  await main()
})
  /*
  }
    */
