const fs = require('fs')
const nanoprocess = require('nanoprocess')
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('../')


function silentOrVoice(data) {
  const samples = Array.from(data)
  const zeros = samples.filter(d=>d==0)
  const zeroPercent = zeros.length / samples.length

  if (zeroPercent < 0.3) return 'voice'
  return 'silence'
}

async function main(num=0) {
  const source = new Source('./clip.wav')
  const wavecore = new Wavecore({ source })

  const INDEX_MS = 800

  await Promise.resolve(wavecore.open())
  console.log(wavecore.core)

  const blocks = []
  const rs = wavecore._rawStream()

  for await (const block of rs) {
    blocks.push(silentOrVoice(block))
  }

  let counter = 0
  blocks.forEach(b=>console.log(`${counter * INDEX_MS} ${counter++} ${b}`))
  //console.log(blocks)
}

main()
