const Wavecore = require('../index')
const MicrophoneStream = require('microphone-stream').default
const toWav = require('audiobuffer-to-wav')
const {
  AudioEnvironment
} = require('@storyboard-fm/soapbox')

async function getMedia(constraints) {
  const audioEnv = new AudioEnvironment()
  console.log(audioEnv)
  const mix = await audioEnv.instantiateMic()
  console.log(mix)
  const micStream = new MicrophoneStream()
  micStream.setStream(mix.outputStream.stream)
  return micStream
}

function playBuf(ctx, buf) {
  const s2 = ctx.createBufferSource()
  s2.buffer = buf
  s2.connect(ctx.destination)
  s2.start()
}

async function main() {
  var abOrig = null
  var abNorm = null
  var s = null
  var audioCtx = new AudioContext()

  const wave = new Wavecore({ ctx: audioCtx })
  console.log(wave)

  let recording = false

  document.getElementById("rec").onclick = async function() {
    if (!recording) {
      s = await getMedia({audio:true,video:false})
      console.log(s)
      wave.recStream(s)
      recording = true
    } else {
      s.stop()
      recording = false
      console.log(wave)
      document.getElementById("info").innerHTML=`
      <h2><b>Core</b></h2>

      <h4>INDEX LENGTH</h4>
      ${wave.length}

      <h4>BYTELENGTH</h4>
        ${wave.byteLength}
      `
      abOrig = await wave.audioBuffer({dcOffset:false})
    }
    document.getElementById("rec").innerHTML = recording ? 'STOP' : 'REC'
  }

  /*
  document.getElementById("norm").onclick = function () {
    playBuf(audioCtx, abNorm)
  }

  document.getElementById("stop").onclick = async function () {
    s.stop()
    console.log(wave)
    document.getElementById("info").innerHTML=`
  <h2><b>Core</b></h2>

  <h4>INDEX LENGTH</h4>
  ${wave.length}

<h4>BYTELENGTH</h4>
  ${wave.byteLength}
`
    abOrig = await wave.audioBuffer({dcOffset:false})
    abNorm = await wave.audioBuffer({dcOffset: true, normalize: true})
  }

  document.getElementById("orig").onclick = async function () {
    playBuf(audioCtx, abOrig)
  }

  */
  document.getElementById("wav").onclick = async function () {
    const wavAb = concatCore ? await concatCore.audioBuffer() : abOrig
    const wav = toWav(wavAb || abOrig, { float32: true })
    console.log(wav, wavAb)
    const blob = new Blob([wav], {type:'audio/wav'})
    console.log(blob)
    console.log(URL.createObjectURL(blob))
  }

  let concatCore = null
  let appCore = null
  let appending = false
  let appSt = null

  document.getElementById("append").onclick = async function () {
    if (appending) {
      appSt.stop()
      appending = false
      console.log(appCore)
      if (!concatCore) {
        concatCore = await wave.concat([appCore])
        await wave.close()
      } else {
        concatCore = await concatCore.concat([appCore])
      }
      console.log(concatCore)
      await appCore.close()
      document.getElementById("info").innerHTML=`
    <h2><b>Core</b></h2>

    <h4>INDEX LENGTH</h4>
    ${concatCore.length}

  <h4>BYTELENGTH</h4>
    ${concatCore.byteLength}
  `
      playBuf(audioCtx, await concatCore.audioBuffer())
    } else {
      appSt = await getMedia({audio:true,video:false})
      console.log(appSt)
      appCore = new Wavecore({ ctx: audioCtx })
      appCore.recStream(appSt)
      appending = true
    }
    document.getElementById("append").innerHTML = appending ? "STOP" : "APPEND"
  }
}

document.getElementById("launch").onclick = async function () {
  main()
}
