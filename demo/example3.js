const fs = require('fs')
const nanoprocess = require('nanoprocess')
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('../')


/*
 * Creates a template Wavecore containing intro and outro music.
 * Then, fills in the template with some spoken word content.
 * Writes show to new Wavecore and outputs as RAW audio data.
 * Converts to a conformant WAV file, the show is now ready to listen.
 */
async function main() {
  const source = new Source('./music.wav')
  const [ head, tail ] = [ new Wavecore({ source }), new Wavecore({ source }) ]
  const source2 = new Source('./clip.wav')
  const middle = new Wavecore( { source: source2 })

  await Promise.all([ head.toHypercore(), middle.toHypercore(), tail.toHypercore()])

  console.log(head.core.length, middle.core.length, tail.core.length)

  const template = await Promise.resolve(head.concat([middle, tail]))
  console.log('template', template)

  console.log('about to play the template...')
  template.play()
}

main()
