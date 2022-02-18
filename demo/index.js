const Wavecore = require('../web')
const MicrophoneStream = require('microphone-stream').default

/*
function stopRec() {
  mr.stop()
}
*/

async function getMedia(constraints) {
  let stream = null;

  const micStream = new MicrophoneStream()

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints)
    micStream.setStream(stream)
    return micStream
    // return stream
  } catch(err) {
    console.error(err)
  }
}



async function main() {
  const wave = new Wavecore()
  console.log(wave)
  const s = await getMedia({audio:true,video:false})
  console.log(s)
  wave.recStream(s)
  /*
  s.on('data', async (d) => {
    await wave.core.append(d)
  })
  setTimeout(async () => {
    s.stop()
    console.log(wave)
    const ab = await wave.audioBuffer()
    console.log(ab)
  }, 5000)
  */

  document.getElementById("stop").onclick = async function () {
    s.stop()
    console.log(wave)
    const ab = await wave.audioBuffer()
    console.log(ab)
  }
  /*
  const stream = recorder(s)
  stream.on('data', d => console.log('data', d))
  wave.recStream(stream)

  setTimeout(() => {
    stream.recorder.stop()
    console.log('stopped')
    console.log(wave, wave.core)
  }, 3000)
  */
}
//main()

document.getElementById("start").onclick = async function () {
  main()
}
