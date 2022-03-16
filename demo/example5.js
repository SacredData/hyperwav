const WavecoreSox = require('../sox')
const fs = require('fs')

async function main() {
  const source = fs.readFileSync('./clip.wav')
  const wave = new WavecoreSox({ source })
  await wave.open()
  const v = await wave.tempo(0.5)
  v.play({ start: 300, end: 350 })
}

main()
