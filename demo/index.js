const Wavecore = require('../web')
const MicrophoneStream = require('microphone-stream').default
const toWav = require('audiobuffer-to-wav')

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
  var abOrig = null
  var abNorm = null

  const wave = new Wavecore()
  console.log(wave)
  const s = await getMedia({audio:true,video:false})
  console.log(s)
  wave.recStream(s)
  var audioCtx = new AudioContext()

  document.getElementById("norm").onclick = async function () {
    const s2 = audioCtx.createBufferSource()
    s2.buffer = abNorm
    s2.connect(audioCtx.destination)
    s2.start()
  }

  document.getElementById("stop").onclick = async function () {
    s.stop()
    console.log(wave)
    document.getElementById("info").innerHTML=`
  <h2><b>Core</b></h2>

  <h4>INDEX LENGTH</h4>
  ${wave.core.length}

<h4>BYTELENGTH</h4>
  ${wave.core.byteLength}
`
    abOrig = await wave.audioBuffer({dcOffset:false})
    abNorm = await wave.audioBuffer({dcOffset: true, normalize: true})
  }

  document.getElementById("orig").onclick = async function () {
    const s1 = audioCtx.createBufferSource()
    s1.buffer = abOrig
    s1.connect(audioCtx.destination)
    s1.start()
  }

  document.getElementById("wav").onclick = async function () {
    const wav = toWav(abOrig, { float32: true })
    console.log(wav)
    const blob = new Blob([wav], {type:'audio/wav'})
    console.log(blob)
    console.log(URL.createObjectURL(blob))
  }
}

document.getElementById("start").onclick = async function () {
  main()
}
