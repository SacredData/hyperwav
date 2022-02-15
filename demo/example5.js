const Wavecore = require('..')
const { Source } = require('@storyboard-fm/little-media-box')

async function main() {
  const source = new Source('./clip.wav')
  const wave = new Wavecore({ source })
  await wave.open()
  const v = await wave.tempo(0.5)
  v.play({ start: 300, end: 350 })
}

main()
