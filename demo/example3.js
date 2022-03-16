const fs = require('fs')
const Wavecore = require('../')


/*
 * Creates a template Wavecore containing intro and outro music.
 * Then, fills in the template with some spoken word content.
 * Writes show to new Wavecore and outputs as RAW audio data.
 * Converts to a conformant WAV file, the show is now ready to listen.
 */
async function main() {
  const source = fs.readFileSync('./music.wav')
  const [ head, tail ] = [ new Wavecore({ source }), new Wavecore({ source }) ]
  const source2 = fs.readFileSync('./clip.wav')
  const middle = new Wavecore( { source: source2 })

  await Promise.all([ head.open(), middle.open(), tail.open()])

  console.log(head.length, middle.length, tail.length)

  const template = await Promise.resolve(head.concat([middle, tail]))
  console.log('template', template)
}

main()
