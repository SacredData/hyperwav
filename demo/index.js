const Wavecore = require('../web')
const recorder = require('media-recorder-stream')

/*
function stopRec() {
  mr.stop()
}
*/

async function getMedia(constraints) {
  let stream = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints)
    return stream
  } catch(err) {
    console.error(err)
  }
}



async function main() {
  const s = await getMedia({audio:true,video:false})
  console.log(s)
  const wave = new Wavecore()
  console.log(wave)
  const stream = recorder(s, {interval:800})
  stream.on('data', d => console.log('data', d))
  wave.recStream(stream)

  setTimeout(() => {
    stream.recorder.stop()
    console.log('stopped')
    console.log(wave, wave.core)
  }, 3000)
}

main()
