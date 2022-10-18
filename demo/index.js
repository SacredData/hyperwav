const Wavecore = require('../index')
const MicrophoneStream = require('microphone-stream').default
const toWav = require('audiobuffer-to-wav')
const {
  AudioEnvironment
} = require('@storyboard-fm/soapbox')
const {
  StreamAnalyserErrors
} = require('@storyboard-fm/stream-analyser')
const Hypercore = require('hypercore')

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
  s2.playbackRate.value = 4.5
  s2.connect(ctx.destination)
  s2.start()
}

function setInfo(core) {
      document.getElementById("info").innerHTML=`
    <h2><b>Core</b></h2>
  <h4>Fork</h4>
    ${core.fork}

    <h4>INDEX LENGTH</h4>
    ${core.length}

  <h4>BYTELENGTH</h4>
    ${core.byteLength}
  `
}

function createSplitPlayback(ctx, cores) {  
  cores.map((core, idx) => {
    let button = document.createElement('button')
    button.innerHTML = `Play Part ${idx + 1}`
    button.onclick = async () => {
      buffer = await core.audioBuffer()
      playBuf(ctx, buffer)
      return false
    }
    document.getElementById('playback').appendChild(button);
  })
  document.getElementById('split').disabled = false
}

async function main() {
  var abOrig = null
  var abNorm = null
  var wave = null
  var s = null
  var audioCtx = new AudioContext()

  wave = new Wavecore({ ctx: audioCtx })
  console.log(wave)

  const analyser = new StreamAnalyserErrors(audioCtx, {core: true})

  let recording = false

  document.getElementById("rec").onclick = async function() {
    if (!recording) {
      s = await getMedia({audio:true,video:false})
      
      analyser.metering(s.stream)
      analyser.addEventListener('beginsilence', () => console.log('silence'))
      analyser.addEventListener('endsilence', () => console.log('speech'))
      analyser.addEventListener('clippingdetected', () => console.log('clipping'))

      wave.recStream(s)
      recording = true
    } else {
      s.stop()
      analyser.stopListening()
      recording = false
      setInfo(wave)
      abOrig = await wave.audioBuffer({dcOffset:false})
      document.getElementById("rec").style.display = "none"
    }
    document.getElementById("rec").innerHTML = recording ? 'STOP' : 'REC'
  }

  document.getElementById("wav").onclick = async function () {
    const wavAb = concatCore ? await concatCore.audioBuffer() : abOrig
    const wav = toWav(wavAb || abOrig, { float32: true })
    console.log(wav, wavAb)
    const blob = new Blob([wav], {type:'audio/wav'})
    console.log(blob)
    console.log(URL.createObjectURL(blob))
  }

  var concatCore = null
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
      setInfo(concatCore)
      // playBuf(audioCtx, await concatCore.audioBuffer())
    } else {
      appSt = await getMedia({audio:true,video:false})
      console.log(appSt)
      analyser.metering(appSt.stream)
      appCore = new Wavecore({ ctx: audioCtx })
      appCore.recStream(appSt)
      appending = true
    }
    document.getElementById("append").innerHTML = appending ? "STOP" : "APPEND"
  }

  document.getElementById("norm").onclick = async function () {
    if (concatCore) {
      playBuf(audioCtx, await concatCore.audioBuffer({normalize: true}))
    } else {
      playBuf(audioCtx, await wave.audioBuffer({normalize: true}))
    }
  }

  document.getElementById("play").onclick = async function () {
    if (concatCore) {
      playBuf(audioCtx, await concatCore.audioBuffer())
    } else {
      playBuf(audioCtx, await wave.audioBuffer())
    }
  }

  document.getElementById("trun").onclick = async function () {
    if (concatCore) {
      const trunLength = concatCore.length - 1
      console.log(concatCore.length, trunLength)
      await concatCore.truncate(trunLength)
      setInfo(concatCore)
    } else {
      const trunLength = wave.length - 1
      console.log(wave.length, trunLength)
      await wave.truncate(trunLength)
      console.log(wave)
      setInfo(wave)
    }
  }

  document.getElementById("split").onclick = async function () {
    document.getElementById('split').disabled = true
    if (concatCore) {
      let cores = await concatCore.split(analyser.core)
      createSplitPlayback(audioCtx, cores)

    } else {
      let cores = await wave.split(analyser.core)
      createSplitPlayback(audioCtx, cores)
    }
  }
}

document.getElementById("launch").onclick = async function () {
  main()
  document.getElementById("demo").style.display = "block"
}