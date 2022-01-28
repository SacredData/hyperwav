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
      const newCore = Wavecore.fromCore(new Hypercore(ram), core0)
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
  describe('#toHypercore', function() {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should read the WAV into a new Hypercore', async function () {
      const core4 = new Wavecore({ source })
      const returnedCore = await Promise.resolve(core4.toHypercore())
      expect(returnedCore).to.be.instanceof(Hypercore) &&
        expect(core4.core).to.be.instanceof(Hypercore) &&
        expect(core4.core.length).to.equal(58)
    })
  })
  describe('#truncate', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should truncate the hypercore', async function () {
      const core5 = new Wavecore({ source })
      await Promise.resolve(core5.toHypercore())
      await core5.truncate(20)
      expect(core5.core.length).to.equal(20)
    })
  })
  describe('#seek', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should provide index and relative offset values', async function () {
      const core6 = new Wavecore({ source })
      await Promise.resolve(core6.toHypercore())
      const [index, relative] = await core6.seek(20000)
      expect(index).to.equal(1) &&
        expect(relative).to.equal(19936)
    })
  })
  describe('#_fileBuffer', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return a buffer of the full source file', async function () {
      const core7 = new Wavecore({ source })
      await Promise.resolve(core7.toHypercore())
      const buffer = await core7._fileBuffer()
      expect(buffer).to.be.instanceof(Buffer)
    })
  })
  describe('#_rawStream', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return a readStream containing the test file', async function () {
      const core8 = new Wavecore({ source })
      await Promise.resolve(core8.toHypercore())
      const rs = core8._rawStream()
      expect(rs).to.have.property('_readableState') &&
        expect(rs.readable).to.be.true
    })
  })
  describe('#_discoveryKey', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return a Buffer containing the hypercore discovery key', async function() {
      const core9 = new Wavecore({ source })
      await Promise.resolve(core9.toHypercore())
      const dk = core9._discoveryKey()
      expect(dk).to.be.instanceof(Buffer)
    })
  })
  describe('#_fork', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return the hypercore fork number', async function () {
      const core10 = new Wavecore({ source })
      await Promise.resolve(core10.toHypercore())
      const forkId = core10._fork()
      expect(typeof(forkId)).to.equal('number') &&
        expect(forkId).to.equal(0)
    })
  })
  describe('#_length', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core11 = new Wavecore({ source })
    it('should return a length of 0 before the WAV is read into the core', function () {
      const length = core11._length()
      expect(length).to.not.equal(null) &&
        expect(length).to.equal(0)
    })
    it('should return a length of 58 after the WAV is read into the core', async function () {
      await Promise.resolve(core11.toHypercore())
      const newLength = core11._length()
      expect(newLength).to.not.equal(null) &&
        expect(newLength).to.equal(58)
    })
  })
  describe('#_keyPair', function() {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should return public and secret keys', async function() {
      const core12 = new Wavecore({ source })
      const kp = core12._keyPair()
      expect(typeof(kp)).to.equal('object')
    })
  })
  describe('#split', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    it('should split at index 20 and return two new Wavecores', async function () {
      const core13 = new Wavecore({ source })
      await Promise.resolve(core13.toHypercore())
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
  })
  describe('#append', async function () {
    const core15 = new Wavecore()
    it('should add the buffer to the hypercore at index 0', async function () {
      await core15.append(Buffer.from('hello'))
      expect(core15.core.length).to.equal(1)
    })
  })
  /*
  describe('#concat', async function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core16 = new Wavecore({source})
    const core17 = new Wavecore({source})
    const concatCore = new Wavecore()
    it('should concatenate the two wavecores into the concatenated core', async function () {
      await Promise.all([core16.toHypercore(), core16.toHypercore()])
      const newCore = await concatCore.concat([core16, core17])
      expect(newCore.core.length).to.equal(116)
    })
  })
  */
  describe('#shift', function () {
    const source = new Source(path.join(__dirname, 'test.wav'))
    const core18 = new Wavecore({ source })
    it('should return a new wavecore with index 0 removed', async function () {
      await Promise.resolve(core18.toHypercore())
      const newCore = await Promise.resolve(core18.shift(1))
      expect(newCore.core.length).to.equal(57)
    })
  })
})
