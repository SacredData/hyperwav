const expect = require('chai').expect
const fs = require('fs')
const Hypercore = require('hypercore')
const path = require('path')
const ram = require('random-access-memory')
const { Readable } = require('stream')
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('../')

describe('Wavecore', function () {
  describe('#from', function () {
    const source = new Source(path.join(__dirname, 'test.wav.raw'))
    const core0 = new Wavecore({ source })
    it('should create a Wavecore from another Wavecore', function () {
      const newCore = Wavecore.fromCore(new Hypercore(ram), {parent: core0, source})
      expect(newCore).to.be.instanceof(Wavecore)
    })
  })
  describe('#fromRaw', function () {
    const source = path.join(__dirname, 'test.wav.raw')
    it('should construct from a raw file', async function () {
      const core34 = Wavecore.fromRaw(source)
      await Promise.resolve(core34.open())
      expect(core34.length).to.equal(57)
    })
  })
  describe('#fromCore', function () {
    const source = path.join(__dirname, 'test.wav.raw')
    it('should return a new Wavecore from a parent Wavecore', async function () {
      const core38 = Wavecore.fromRaw(source)
      await Promise.resolve(core38.open())
      const newCore = Wavecore.fromCore(core38.core, core38)
      expect(newCore).to.be.instanceof(Wavecore)
    })
  })
  describe('#constructor', function() {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return a new instance of a Wavecore', function () {
      const core1 = new Wavecore({ source })
      expect(core1).to.be.instanceof(Wavecore)
    })
    it('should work if no source is provided', () => {
      const core2 = new Wavecore()
      expect(core2).to.be.instanceof(Wavecore)
    })
    it('should work if a hypercore is provided as an argument', function () {
      const hypercore = new Hypercore(ram)
      const core3 = new Wavecore({ core: hypercore })
      expect(core3).to.be.instanceof(Wavecore)
    })
    it('should accept a custom random-access-storage interface', async function () {
      const customStorage = new Wavecore({ storage: new require('random-access-file')('./testy') })
      expect(customStorage).to.be.instanceof(Wavecore)
    })
  })
  describe('#open', function() {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should read the WAV into a new Hypercore', async function () {
      const core4 = new Wavecore({ source })
      const returnedCore = await Promise.resolve(core4.open())
      expect(returnedCore).to.be.instanceof(Hypercore) &&
        expect(core4.core).to.be.instanceof(Hypercore) &&
        expect(core4.core.length).to.equal(57)
    })
  })
  describe('#has', function () {
    const core37 = new Wavecore()
    it('should have index 1', async function () {
      await core37.addBlank(3)
      const has = await core37.has(1)
      expect(has).to.equal(true)
    })
  })
  describe('#truncate', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should truncate the hypercore', async function () {
      const core5 = new Wavecore({ source })
      await Promise.resolve(core5.open())
      await core5.truncate(20)
      expect(core5.core.length).to.equal(20)
    })
    it('should snapshot the wavecore if that option is passed', async function () {
      const core5b = new Wavecore({ source })
      await Promise.resolve(core5b.open())
      await core5b.truncate(19, { snapshot: true })
      expect(core5b.core.length).to.equal(19) &&
        expect(core5b.sessions[1].length).to.equal(57) &&
        expect(core5b.sessions.length).to.equal(2)
    })
    it('should not succeed if new length is greater than old length', async function () {
      const core5c = new Wavecore()
      try {
        await core5c.truncate(2)
      } catch (err) {
        expect(err).to.not.equal(null)
      }
    })
    it('should not accept a non-number', async function () {
      let results = null
      const core5d = new Wavecore()
      results = await core5d.truncate('hello')
      expect(results).to.be.undefined
    })
  })
  describe('#seek', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core6 = new Wavecore({ source })
    it('should provide index and relative offset values', async function () {
      await Promise.resolve(core6.open())
      const [index, relative] = await core6.seek(20000)
      expect(index).to.equal(0) &&
        expect(relative).to.equal(20000)
    })
    it('should provide the next zeroCrossing', async function () {
      const [index, relative, byteOffset] = await core6.seek(20000, {zero:true})
      expect(byteOffset).to.equal(20001)
    })
  })
  describe('#_fileBuffer', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return a buffer of the full source file', async function () {
      const core7 = new Wavecore({ source })
      await Promise.resolve(core7.open())
      const buffer = await core7._fileBuffer()
      expect(buffer).to.be.instanceof(Buffer)
    })
    it('should fail with no source added', async function () {
      const core7b = new Wavecore()
      try {
        await Promise.resolve(core7.open())
      } catch (err) {
        expect(err).to.not.equal(null)
      }
    })
  })
  describe('#_rawStream', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return a readStream containing the test file', async function () {
      const core8 = new Wavecore({ source })
      await Promise.resolve(core8.open())
      const rs = core8._rawStream()
      expect(rs).to.have.property('_readableState') &&
        expect(rs.readable).to.be.true
    })
  })
  describe('#discoveryKey', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return a Buffer containing the hypercore discovery key', async function() {
      const core9 = new Wavecore({ source })
      await Promise.resolve(core9.open())
      const dk = core9.discoveryKey
      expect(dk).to.be.instanceof(Buffer)
    })
  })
  describe('#fork', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return the hypercore fork number', async function () {
      const core10 = new Wavecore({ source })
      await Promise.resolve(core10.open())
      const forkId = core10.fork
      expect(typeof(forkId)).to.equal('number') &&
        expect(forkId).to.equal(0)
    })
  })
  describe('#length', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core11 = new Wavecore({ source })
    it('should return a length of 0 before the WAV is read into the core', function () {
      const length = core11.length
      expect(length).to.not.equal(null) &&
        expect(length).to.equal(0)
    })
    it('should return a length of 58 after the WAV is read into the core', async function () {
      await Promise.resolve(core11.open())
      const newLength = core11.length
      expect(newLength).to.not.equal(null) &&
        expect(newLength).to.equal(57)
    })
  })
  describe('#keyPair', function() {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return public and secret keys', async function() {
      const core12 = new Wavecore({ source })
      const kp = core12.keyPair
      expect(typeof(kp)).to.equal('object')
    })
  })
  describe('#split', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
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
  describe('#gain', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core31 = new Wavecore({ source })
    it('should increase gain by 2.0dBFS', async function () {
      await Promise.resolve(core31.open())
      const gainInc = await core31.gain(2)
      const gainStats = await gainInc.stats()
      expect(gainStats.split('\n')[3]).to.equal('Pk lev dB       0.00')
    })
  })
  describe('#addBlank', function () {
    const core14 = new Wavecore()
    it('should produce 3 indeces of blank data and append to the end', async function() {
      await core14.addBlank(3)
      expect(core14.core.length).to.equal(3)
    })
    it('should produce 1 index of blank data by default', async function () {
      await core14.addBlank()
      expect(core14.core.length).to.equal(4)
    })
    it('should not add anything when n=0', async function () {
      await core14.addBlank(0)
      expect(core14.core.length).to.equal(4)
    })
  })
  describe('#append', async function () {
    const core15 = new Wavecore()
    it('should add the buffer to the hypercore at index 0', async function () {
      await core15.append(Buffer.from('hello'))
      expect(core15.core.length).to.equal(1)
    })
  })
  describe('#shift', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core18 = new Wavecore({ source })
    it('should return a new wavecore with index 0 removed', async function () {
      await Promise.resolve(core18.open())
      const newCore = await Promise.resolve(core18.shift(1))
      expect(newCore.core.length).to.equal(56)
    })
  })
  describe('#close', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core19 = new Wavecore({ source })
    it('should close the hypercore', async function () {
      await Promise.resolve(core19.open())
      const result = await core19.close()
      expect(result).to.equal(true)
    })
  })
  describe('#lastIndexSize', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core20 = new Wavecore({ source })
    it('should return the last index size in bytes', async function () {
      await Promise.resolve(core20.open())
      const result = core20.lastIndexSize
      expect(result).to.equal(26156)
    })
  })
  describe('#audioBuffer', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
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
  })
  describe('#_nextZero', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core22 = new Wavecore({ source })
    it('should find the next zero crossing after 741444 bytes', async function () {
      await Promise.resolve(core22.open())
      const nzArr = await Promise.resolve(core22._nextZero(741444))
      expect(nzArr).to.be.instanceof(Array).that.includes(9).that.includes(50365)
    })
    it('should accept a seek() return value', async function () {
      const seekVal = await core22.seek(741444)
      const nz = await core22._nextZero(seekVal)
      expect(nz).to.be.instanceof(Array)
    })
  })
  describe('#wav', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core23 = new Wavecore({ source })
    const core24 = new Wavecore({ source })
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
  })
  describe('#tempo', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core25 = new Wavecore({ source })
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
      expect(statsTest.core.byteLength).to.equal(2163478)
    })
  })
  describe('#stats', function () {
      const source = new Source(path.join(__dirname, 'test.wav'))
      const core26 = new Wavecore({ source })
    it('should get sox stats and stat output on the audio data', async function () {
      await Promise.resolve(core26.open())
      const statsOut = await core26.stats()
      expect(statsOut).to.not.equal(null)
    })
  })
  describe('#_volAdjust', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core27 = new Wavecore({ source })
    it('should get the max volume adjustment without clipping', async function () {
      await Promise.resolve(core27.open())
      const vol = await core27._volAdjust()
      expect(vol).to.equal(1.076)
    })
  })
  describe('#concat', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core30 = new Wavecore({ source })
    it('should concat the cores to the source and make a new wavecore', async function () {
      await Promise.resolve(core30.open())
      const splits = await core30.split(20)
      const concatCore = await core30.concat(splits)
      expect(concatCore).to.not.equal(null) &&
        expect(concatCore.length).to.equal(114)
    })
  })
  describe('#vad', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core32 = new Wavecore({ source })
    it('should remove excessive silence from the recording', async function () {
      await Promise.resolve(core32.open())
      const vadCore = await core32.vad()
      expect(vadCore.core.byteLength).to.equal(4298156)
    })
  })
  describe('#norm', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core28 = new Wavecore({ source })
    it('should normalize the audio to 0dBFS', async function () {
      await Promise.resolve(core28.open())
      const norm = await core28.norm()
      const stats = await norm.stats()
      expect(stats.split('\n')[3]).to.equal('Pk lev dB      -0.00')
    })
  })
  describe('#recStream', function () {
    it('should record a readable stream into the hypercore', async function () {
      const source = path.join(__dirname, 'test.wav.raw')
      const core35 = new Wavecore()
      const rs = fs.createReadStream(source)
      rs.on('close', async function () {
        await core35.core.update()
        expect(core35.length).to.equal(67)
      })
      core35.recStream(rs)
    })
  })
  describe('#liveStream', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core29 = new Wavecore({ source })
    it('should return a live ReadableStream of the audio input', async function () {
      await Promise.resolve(core29.open())
      const ls = core29.liveStream
      expect(ls).to.be.instanceof(Object).that.has.any.key('live')
    })
  })
  describe('#tag', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core33 = new Wavecore({ source })
    it('should allow user to write a RIFF tag to the core', async function () {
      await Promise.resolve(core33.open())
      core33.tag('TEST', '1234')
      expect(core33.tags.size).to.equal(1)
    })
  })
  describe('#session', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core36 = new Wavecore({ source })
    it('should return a new session', async function () {
      await Promise.resolve(core36.open())
      const newCore = core36.session()
      expect(newCore).to.be.instanceof(Hypercore)
    })
  })
})
