const expect = require('chai').expect
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
        expect(core5b.sessions()[1].length).to.equal(57) &&
        expect(core5b.sessions().length).to.equal(2)
    })
  })
  describe('#seek', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should provide index and relative offset values', async function () {
      const core6 = new Wavecore({ source })
      await Promise.resolve(core6.open())
      const [index, relative] = await core6.seek(20000)
      expect(index).to.equal(0) &&
        expect(relative).to.equal(20000)
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
    it('should split at index 20 and return two new Wavecores', async function () {
      const core13 = new Wavecore({ source })
      await Promise.resolve(core13.open())
      Promise.resolve(await core13.split(20)).then(newCores => {
        expect(newCores).to.be.an('array') &&
          expect(newCores[0].length).to.equal(20) &&
          expect(newCores[1].length).to.equal(38)
      })
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
  describe('#_audioBuffer', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core21 = new Wavecore({ source })
    it('should produce an audiobuffer from the PCM data', async function () {
      await Promise.resolve(core21.open())
      const ab = await Promise.resolve(core21._audioBuffer())
      expect(ab).to.be.instanceof(Object) &&
        expect(ab).to.have.property('length')
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
  })
  // TODO fix these tests on GitHub Actions runner
  // Gotta install SoX somehow on that environment and put it in PATH
  /*
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
  */
})
