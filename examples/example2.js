const fs = require('fs')
const path = require('path')
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('..')

const source = new Source(path.join(__dirname, '..', './test/test.wav'))
const w = new Wavecore({ source })

async function main() {
  await Promise.resolve(w.toHypercore())
  console.log('splitting Wavecore at index 22....')
  const [head, tail] = await Promise.resolve(w.split(22))
  console.log('done!', head, tail)
  const headWrite = fs.createWriteStream('head.wav')
  // TODO function to convert split WAV audio from RAW to WAV
  const tailWrite = fs.createWriteStream('tail.raw')
  head.core.createReadStream().pipe(headWrite)
  tail.core.createReadStream().pipe(tailWrite)
  console.log('piped for writing...')
  headWrite.on('done', () => {
    tailWrite.on('done', () => {
        return console.log('done')
    })
  })
}

main()
