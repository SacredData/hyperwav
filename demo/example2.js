const fs = require('fs')
const path = require('path')
const Wavecore = require('..')

const source = fs.readFileSync(path.join(__dirname, '..', './test/test.wav'))
const w = new Wavecore({ source })

async function main() {
  await Promise.resolve(w.open())
  console.log('splitting Wavecore at index 22....')
  const [head, tail] = await Promise.resolve(w.split(22))
  console.log('done!', head, tail)
  const headWrite = fs.createWriteStream('head.wav')
  // TODO function to convert split WAV audio from RAW to WAV
  const tailWrite = fs.createWriteStream('tail.raw')
  head.createReadStream().pipe(headWrite)
  tail.createReadStream().pipe(tailWrite)
  console.log('piped for writing...')
  headWrite.on('done', () => {
    tailWrite.on('done', () => {
        return console.log('done')
    })
  })
}

main()
