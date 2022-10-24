const { AudioContext } = require('web-audio-api')
const { detect } = require('audio-format')
const expect = require('chai').expect
const fs = require('fs')
const Hypercore = require('hypercore')
const path = require('path')
const ram = require('random-access-memory')
const { Readable, PassThrough } = require('stream')
const Wavecore = require('../')
const WaveFile = require('wavefile').WaveFile

const source = fs.readFileSync(path.join(__dirname, 'test.wav.raw'))

describe('Wavecore', function () {
  /*
  describe('#fromStream', function () {
    it('should construct from a stream', async function () {
      const core40 = Wavecore.fromStream(fs.createReadStream(path.join(__dirname, 'test.wav.raw')))
      await core40.core.update()
      expect(core40).to.be.instanceof(Wavecore)
    })
  })
  */
  describe('#constructor', function() {
    it('should return a new instance of a Wavecore', function () {
      const core1 = new Wavecore()
      expect(core1).to.be.instanceof(Wavecore)
    })
    it('should accept a custom random-access-storage interface', async function () {
      const customStorage = new Wavecore({ storage: new require('random-access-file')('./testy') })
      expect(customStorage).to.be.instanceof(Wavecore)
    })
    it('should accept an AudioContext', async function () {
      const ctx = new AudioContext()
      const contextTest = new Wavecore({ ctx })
      expect(contextTest).to.be.instanceof(Wavecore)
    })
    it('should accept a parent', async function () {
      const parent = new Wavecore()
      await parent.open({ source })
      const child = new Wavecore({ parent })
      expect(child).to.be.instanceof(Wavecore) &&
        expect(child).to.have.property('parent') &&
        expect(child.parent).to.be.instanceof(Wavecore)
    })
    it('should accept a Readable source', async function () {
      const streamSource = Readable.from(source)
      const streamTest = new Wavecore({ source: streamSource })
      expect(streamTest).to.be.instanceof(Wavecore)
    })
    it('should accept a PassThrough source', async function () {
      const streamSource2 = PassThrough.from(source)
      const streamTest2 = new Wavecore({ source: streamSource2 })
      expect(streamTest2).to.be.instanceof(Wavecore)
    })
    it('should accept a custom index size', async function () {
      const indexSize = 4096
      const sizeTest = new Wavecore({ indexSize, source })
      expect(sizeTest).to.have.property('indexSize') &&
        expect(sizeTest.indexSize).to.equal(4096)
    })
    it('should accept an Array source', async function () {
      const srcArr = Array.from(source)
      const arrTest = new Wavecore({ source: srcArr })
      await arrTest.open()
      expect(arrTest).to.be.instanceof(Wavecore) &&
        expect(arrTest.length).to.equal(197)
    })
  })
  describe('#open', function() {
    it('should read the WAV into a new Hypercore', async function () {
      const core4 = new Wavecore()
      await Promise.resolve(core4.open({ source }))
      expect(core4).to.be.instanceof(Wavecore) &&
        expect(core4.length).to.equal(197)
    })
  })
  describe('#_seek', function () {
    const core6 = new Wavecore()
    it('should provide index and relative offset values', async function () {
      await Promise.resolve(core6.open({ source }))
      const [index, relative] = await core6._seek(20000)
      expect(index).to.equal(0) &&
        expect(relative).to.equal(20000)
    })
    it('should provide the next zeroCrossing', async function () {
      const [index, relative, byteOffset] = await core6._seek(20000, {zero:true})
      expect(byteOffset).to.equal(20001)
    })
  })
  describe('#_nextZero', function () {
    const core22 = new Wavecore({ source })
    it('should find the next zero crossing after 741444 bytes', async function () {
      await Promise.resolve(core22.open())
      const nzArr = await Promise.resolve(core22._nextZero(741444))
      expect(nzArr).to.be.instanceof(Array).that.includes(33).that.includes(13871)
    })
    it('should accept a seek() return value', async function () {
      const seekVal = await core22.seek(741444)
      const nz = await core22._nextZero(seekVal)
      expect(nz).to.be.instanceof(Array)
    })
  })
  describe('#_rawStream', function () {
    it('should return a readStream containing the test file', async function () {
      const core8 = new Wavecore({ source })
      await Promise.resolve(core8.open())
      const rs = core8._rawStream()
      expect(rs).to.have.property('_readableState') &&
        expect(rs.readable).to.be.true
    })
  })
  describe('#split', function () {
    const core13 = new Wavecore({ source })
    it('should split at index 20 and return two new Wavecores', async function () {
      await Promise.resolve(core13.open())
      Promise.resolve(await core13.split(20)).then(newCores => {
        expect(newCores).to.be.an('array') &&
          expect(newCores[0].length).to.equal(20) &&
          expect(newCores[1].length).to.equal(38)
      })
    })
    it('should reject index numbers greater than its own length', async function (){
      try {
        const error = await core13.split(8000)
      } catch (err) {
        expect(err).to.not.equal(null)
      }
    })
  })
  describe('#addBlank', function () {
    const core14 = new Wavecore()
    it('should produce 3 indeces of blank data and append to the end', async function() {
      await core14.addBlank(3)
      expect(core14.length).to.equal(3)
    })
    it('should produce 1 index of blank data by default', async function () {
      await core14.addBlank()
      expect(core14.length).to.equal(4)
    })
    it('should not add anything when n=0', async function () {
      await core14.addBlank(0)
      expect(core14.length).to.equal(4)
    })
  })
  describe('#shift', function () {
    const core18 = new Wavecore({ source })
    it('should return a new wavecore with index 0 removed', async function () {
      await Promise.resolve(core18.open())
      const newCore = await Promise.resolve(core18.shift(1))
      expect(newCore.length).to.equal(196)
    })
  })
  describe('#lastIndexSize', function () {
    const core20 = new Wavecore({ source })
    it('should return the last index size in bytes', async function () {
      await Promise.resolve(core20.open())
      const result = core20.lastIndexSize
      expect(result).to.equal(5112)
    })
  })
  describe('#audioBuffer', function () {
    const core21 = new Wavecore({ source })
    it('should produce an audiobuffer from the PCM data', async function () {
      await Promise.resolve(core21.open())
      const ab = await Promise.resolve(core21.audioBuffer())
      expect(ab).to.be.instanceof(Object) &&
        expect(ab).to.have.property('length')
    })
    it('should normalize the audio', async function () {
      const ab1 = await Promise.resolve(core21.audioBuffer({
        normalize: true
      }))
      const ab2 = await Promise.resolve(core21.audioBuffer({
        normalize: false
      }))
      expect(ab1).to.not.equal(ab2)
    })
    it('should store the buffer in the class instance', async function () {
      await Promise.resolve(core21.audioBuffer({ store: true }))
      expect(core21).to.have.property('audioBuffer')
    })
    it('should mix audio if given another audiobuffer', async function () {
      const ab = core21.audioBuffer
      const mixTest = new Wavecore({ source })
      await mixTest.open()
      const mixedAudio = await mixTest.audioBuffer({mix:ab})
      expect(mixedAudio).to.not.equal(null)
    })
    it('should use a custom sampling rate', async function () {
      const rateTest = new Wavecore({ source })
      await rateTest.open()
      const rateAudio = await rateTest.audioBuffer({ rate: 48000 })
      const checkAudio = detect(rateAudio)
      expect(rateAudio.sampleRate).to.equal(48000) &&
        expect(checkAudio.sampleRate).to.equal(48000)
    })
    it('should use a custom channel count', async function () {
      const chanTest = new Wavecore({ source })
      await chanTest.open()
      const chanAudio = await chanTest.audioBuffer({ rate: 48000, channels: 2 })
      const checkAudio = detect(chanAudio)
      expect(chanAudio.numberOfChannels).to.equal(2) &&
        expect(checkAudio.channels).to.equal(2)
    })
    it('should use a custom sampling format', async function () {
      const fmtTest = new Wavecore({ source })
      await fmtTest.open()
      const fmtAudio = await fmtTest.audioBuffer({ channels: 1, sampling: 'uint16', rate: 48000 })
      expect(fmtAudio.duration).to.equal(45.072)
    })
  })
  describe('#concat', function () {
    const core30 = new Wavecore({ source })
    it('should concat the cores to the source and make a new wavecore', async function () {
      await Promise.resolve(core30.open())
      const splits = await core30.split(20)
      const concatCore = await core30.concat(splits)
      expect(concatCore).to.not.equal(null) &&
        expect(concatCore.length).to.equal(394)
    })
  })
  describe('#recStream', function () {
    it('should record a readable stream into the hypercore', async function () {
      const core35 = new Wavecore()
      const rs = Readable.from(source)
      rs.on('close', async function () {
        await core35.update()
        expect(core35.length).to.equal(57)
      })
      core35.recStream(rs)
    })
  })
  describe('#liveStream', function () {
    const core29 = new Wavecore({ source })
    it('should return a live ReadableStream of the audio input', async function () {
      await Promise.resolve(core29.open())
      const ls = core29.liveStream
      expect(ls).to.be.instanceof(Object).that.has.any.key('live')
    })
  })
  describe('#tag', function () {
    const core33 = new Wavecore()
    it('should allow user to write a RIFF tag to the core', async function () {
      core33.tag('TEST', '1234')
      expect(core33.tags.size).to.equal(1)
    })
    it('should accept an array as first argument to do multiple tags', async function () {
      core33.tag([ ['ABCD', '4567'], ['HELO', 'WURLD'] ])
      expect(core33.tags.size).to.equal(3)
    })
  })
})
