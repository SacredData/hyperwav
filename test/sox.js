const expect = require('chai').expect
const fs = require('fs')
const Hypercore = require('hypercore')
const path = require('path')
const ram = require('random-access-memory')
const { Readable } = require('stream')
const WavecoreSox = require('../sox')
const WaveFile = require('wavefile').WaveFile

const source = fs.readFileSync(path.join(__dirname, 'test.wav.raw'))

describe('WavecoreSox', function () {
  describe('#stats', function () {
      const core26 = new WavecoreSox({ source })
    it('should get sox stats and stat output on the audio data', async function () {
      await Promise.resolve(core26.open())
      const statsOut = await core26.stats()
      expect(statsOut).to.not.equal(null)
    })
  })
  describe('#_volAdjust', function () {
    const core27 = new WavecoreSox({ source })
    it('should get the max volume adjustment without clipping', async function () {
      await Promise.resolve(core27.open())
      const vol = await core27._volAdjust()
      // expect(vol).to.equal(1.076)
      expect(vol).to.equal(1.189)
    })
  })
  describe('#gain', function () {
    const core31 = new WavecoreSox({ source })
    it('should increase gain by 2.0dBFS', async function () {
      await Promise.resolve(core31.open())
      const gainInc = await core31.gain(2)
      const gainStats = await gainInc.stats()
      expect(gainStats.split('\n')[3]).to.equal('Pk lev dB       0.00')
    })
  })
  describe('#tempo', function () {
    const core25 = new WavecoreSox({ source })
    it('should slow down the audio by 50%', async function () {
      await Promise.resolve(core25.open())
      const orig = core25.core.byteLength
      const slowBy50 = await core25.tempo(0.5)
      await slowBy50.core.update()
      const slow = slowBy50.core.byteLength
      expect(slow).to.equal(orig*2)
    })
    it('should speed up the audio by 200%', async function () {
      const orig = core25.core.byteLength
      const fasterBy200 = await core25.tempo(2.0)
      await fasterBy200.core.update()
      const faster = fasterBy200.core.byteLength
      expect(faster).to.equal(orig/2)
    })
    it('should provide stats', async function () {
      const statsTest = await core25.tempo(2.0, { stats: true })
      expect(statsTest.core.byteLength).to.equal(2163456)
    })
  })
  describe('#vad', function () {
    const core32 = new WavecoreSox({ source })
    it('should remove excessive silence from the recording', async function () {
      await Promise.resolve(core32.open())
      const vadCore = await core32.vad()
      expect(vadCore.core.byteLength).to.equal(4298112)
    })
  })
  describe('#norm', function () {
    const core28 = new WavecoreSox({ source })
    it('should normalize the audio to 0dBFS', async function () {
      await Promise.resolve(core28.open())
      const norm = await core28.norm()
      const stats = await norm.stats()
      expect(stats.split('\n')[3]).to.equal('Pk lev dB      -0.00')
    })
  })
  describe('#wav', function () {
    const core23 = new WavecoreSox({ source })
    const core24 = new WavecoreSox({ source })
    const core24b = new WavecoreSox({ source })
    it('should produce a buffer of the WAV file output', async function () {
      await Promise.resolve(core23.open())
      const wavBuf = await Promise.resolve(core23.wav())
      expect(wavBuf).to.be.instanceof(Buffer)
    })
    it('should store the buffer in the wavecore class instance', async function () {
      await Promise.resolve(core24.open())
      await Promise.resolve(core24.wav({store: true}))
      expect(core24.wavBuffer).to.be.instanceof(Buffer)
    })
    it('should create a wavefile instance when storing the buffer', async function () {
      await Promise.resolve(core24b.open())
      await Promise.resolve(core24b.wav({store:true}))
      expect(core24b.wavFile).to.be.instanceof(WaveFile)
    })
  })
})
