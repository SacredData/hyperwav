const Wavecore = require('../web')
const MicrophoneStream = require('microphone-stream').default


async function getMedia(constraints) {
  let stream = null;

  const micStream = new MicrophoneStream()

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints)
    micStream.setStream(stream)
    return micStream
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

  document.getElementById("stop").onclick = async function () {
    s.stop()
    console.log(wave)
    const abProc = await wave.audioBuffer({dcOffset: true, normalize: true, store: true})
    console.log(abProc)
    const audioCtx = new AudioContext()
    const s2 = audioCtx.createBufferSource()
    s2.buffer = abProc
    s2.connect(audioCtx.destination)
    s2.start()
  }
}

document.getElementById("start").onclick = async function () {
  main()
}
