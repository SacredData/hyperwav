const fs = require('fs')
const nanoprocess = require('nanoprocess')
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('../')


function silentOrVoice(data) {
  const samples = Array.from(data)
  const zeros = samples.filter(d=>d==0)
  const zeroPercent = zeros.length / samples.length
  console.log('zero percentage:', zeroPercent)

  if (zeroPercent < 0.1) return 'voice'
  return 'silence'
}

async function main(num=0) {
  const source = new Source('./clip.wav')
  const wavecore = new Wavecore({ source })

  await Promise.resolve(wavecore.toHypercore())

  console.log(wavecore.core)

  const i = await wavecore.core.get(num)
  console.log(silentOrVoice(i))
}

main(23)
