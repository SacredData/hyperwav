const fs = require('fs')
const Hypercore = require('hypercore')
const { PassThrough } = require('stream')
const ram = require('random-access-memory')
const { Source } = require('@storyboard-fm/little-media-box')
const WaveFile = require('wavefile').WaveFile

/**
 * The `Wavecore` class provides a Hypercore v10 interface for working with WAV
 * audio files in a real-time, peer-to-peer context.
 * @class
 */
class Wavecore {
  static coreOpts() {
    return { valueEncoding: 'binary', overwrite: true, createIfMissing: true }
  }
  static fromCore(core, parent) {
    return new this({ core, parent })
  }
  /**
   * The `Wavecore` class constructor.
   * @arg {Object} [opts={}] - Options for the class constructor.
   * @arg {Hypercore} [opts.core=null] - Provide a previously-made hypercore.
   * @arg {Source} [opts.source=null] - Provide `little-media-box` source.
   * @arg {random-access-storage} [opts.storage=ram] - Provide storage instance.
   * @returns {Wavecore}
   */
  constructor(opts = { core: null, parent: null, source: null, storage: ram }) {
    this.core = null
    this.source = null
    // Declaring a specific storage supercedes defining a specific hypercore
    if (opts.storage) {
      this.core = new Hypercore(opts.storage, Wavecore.coreOpts())
    } else {
    }
    const { core, parent, source } = opts
    if (parent) {
      this.parent = parent
      this.source = parent.source
      if (core instanceof Hypercore) this.core = core
    } else {
      // if (parent !== null) this.parent = parent
      // Instantiate stream for appending WAV file data to hypercore
      if (source instanceof Source) this.source = source
      // Assign to a hypercore provided via constructor arguments
      if (core instanceof Hypercore) this.core = core
    }
    // If there is still no hypercore lets just make a sane default one
    if (!this.core) this.core = new Hypercore(ram, Wavecore.coreOpts())
    this.core.on('ready', () =>
      console.log('core is ready!', this.core.keyPair)
    )
  }
  /**
   * Get the Wavecore's discovery key so the hypercore can be found by others.
   * @returns {Buffer} discoveryKey
   */
  _discoveryKey() {
    return this.core.discoveryKey
  }
  _encryptionKey() {
    return this.core.encryptionKey
  }
  /**
   * Returns a `Promise` containing a `Buffer` of the source audio file.
   * Used internally to read the source WAV asset into a Hypercore v10 data
   * structure.
   * @returns {Promise} buffer
   */
  _fileBuffer() {
    return new Promise((resolve, reject) => {
      if (!this.source) reject(new Error('Add a source first'))
      this.source.open((err) => {
        if (err) reject(err)
        resolve(fs.readFileSync(this.source.pathname))
      })
    })
  }
  /**
   * Return the fork ID of the Wavecore.
   * @returns {Number} forkId
   */
  _fork() {
    return this.core.fork
  }
  /**
   * Returns an `Object` with the public and secret keys for the Wavecore.
   * @returns {Object} keyPair
   */
  _keyPair() {
    return this.core.keyPair
  }
  /**
   * Returns the current length of the Wavecore's hypercore.
   * @returns {Number} length
   */
  _length() {
    return this.core.length
  }
  /**
   * Returns a `ReadStream` of the source audio file via its Hypercore v10 data
   * structure. Can indicate a custom range to only grab a portion of the file
   * as a readable stream.
   * @arg {Number} [start=1] - Index from which to start the stream
   * @arg {Number} [end=-1] - Index where the stream should end.
   * @returns {Readable} readStream
   */
  _wavStream(start = 1, end = -1) {
    try {
      return this.core.createReadStream({ start, end })
    } catch (err) {
      throw err
    }
  }
  /**
   * Returns index and byte position of a byte offset.
   * @async
   * @arg {Number} byteOffset - Number of bytes to seek from beginning of file
   * @returns {Array} seekData - `[index, relativeOffset]`
   */
  async seek(byteOffset) {
    try {
      const [index, relativeOffset] = await this.core.seek(byteOffset)
      return [index, relativeOffset]
    } catch (err) {
      console.error(err)
      return
    }
  }
  /**
   * Returns a Promise which resolve a Wavecore that begins at the provided
   * index number. Use this to trim the Wavecore from the beginning of the file.
   * @returns {Wavecore} newCore
   */
  async shift(index = 1) {
    return new Promise((resolve, reject) => {
      const shiftedRs = this.core.createReadStream({ start: index })
      const newCore = new Hypercore(ram)
      const writer = newCore.createWriteStream()
      writer
        .on('close', () => {
          resolve(Wavecore.fromCore(newCore, this))
        })
        .on('error', (err) => reject(err))

      shiftedRs.pipe(writer)
    })
  }
  /**
   * Splits the Wavecore at the provided index number, returning an array of two
   * new `Wavecore` instances.
   * @arg {Number} index - Index number from which to split the Wavecore audio.
   * @returns {Wavecore[]} cores - Array of the new head and tail hypercores
   */
  split(index) {
    return new Promise((resolve, reject) => {
      const [headCore, tailCore] = [new Hypercore(ram), new Hypercore(ram)]
      const ptTail = new PassThrough()
      ptTail.on('data', (d) => tailCore.append(d))
      ptTail.on('close', async () => {
        try {
          const headStream = this.core.createReadStream({
            start: 1,
            end: index,
          })
          const ptHead = new PassThrough()
          ptHead.on('data', (d) => headCore.append(d))
          ptHead.on('close', () => {
            const wavecores = [headCore, tailCore].map((c) =>
              Wavecore.fromCore(c, this)
            )
            resolve(wavecores)
          })
          headStream.pipe(ptHead)
        } catch (err) {
          reject(err)
        }
      })
      const splitStream = this.core.createReadStream({ start: index })
      splitStream.pipe(ptTail)
    })
  }
  /**
   * Reads the source WAV into the class instance's Hypercore v10
   * @async
   * @arg {Object} [opts={}] - Options object.
   * @arg {Boolean} [opts.loadSamples=false] - Whether to load WAV samples into memory
   * @arg {Source} [opts.source=null] - Declare a `Source` before loading.
   * @returns {Hypercore} - The Hypercore v10 data structure
   */
  async toHypercore(opts = { loadSamples: false, source: null }) {
    const { loadSamples, source } = opts
    if (source instanceof Source) this.source = source
    try {
      // Get WAV metadata and headers for index 0 of our hypercore
      const wavfile = new WaveFile()
      wavfile.fromBuffer(await this._fileBuffer(), loadSamples)

      // Grab useful metadata from the wavfile object to append
      const { chunkSize, cue, fmt, smpl, tags } = wavfile

      await this.core.ready()

      return new Promise((resolve, reject) => {
        // PassThrough will append each block received from readStream to hypercore
        const pt = new PassThrough()
        pt.on('error', (err) => reject(err))
        pt.on('data', (d) => this.core.append(d))
        pt.on('close', async () => {
          await this.core.update()
          resolve(this.core)
        })

        // const rs = fs.createReadStream(this.source.pathname, {highWaterMark: 8 * 1024})
        const rs = fs.createReadStream(this.source.pathname, {
          highWaterMark: 76800,
        })
        rs.on('error', (err) => reject(err))

        this.core
          // First, create index 0 with all necessary WAV metadata
          .append(
            JSON.stringify(
              Object.assign({ chunkSize, cue, fmt, smpl, tags }, {})
            )
          )
          // Second, read WAV into Hypercore, beginning at index 1
          .then(() => rs.pipe(pt))
          .catch((err) => reject(err))
      })
    } catch (err) {
      throw err
    }
  }
  /**
   * Truncate the Hypercore to a shorter length.
   * @async
   * @arg {Number} length - The new length. Must be shorter than current length.
   */
  async truncate(length) {
    if (!length || !length instanceof Number) return
    if (length > this.core.length) throw new Error('Must be a shorter length')
    await this.core.truncate(length)
    return
  }
}

module.exports = Wavecore
