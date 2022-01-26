const fs = require('fs')
const Hypercore = require('hypercore')
const MultiStream = require('multistream')
const nanoprocess = require('nanoprocess')
const { PassThrough, Readable } = require('stream')
const ram = require('random-access-memory')
const Replicator = require('@hyperswarm/replicator')
const { Source } = require('@storyboard-fm/little-media-box')
const WaveFile = require('wavefile').WaveFile

const INDEX_SIZE = 76800

/**
 * The `Wavecore` class provides a Hypercore v10 interface for working with WAV
 * audio files in a real-time, peer-to-peer context.
 * @class
 */
class Wavecore {
  /**
   * Get the default hypercore instantiation options
   * @returns {Object} coreOpts
   */
  static coreOpts() {
    return { valueEncoding: 'binary', overwrite: true, createIfMissing: true }
  }
  /**
   * Get new Wavecore from a previously-instantiated hypercore and its parent
   * Wavecore.
   * @arg {Wavecore} core - The Hypercore to copy from
   * @arg {Wavecore} parent - The Wavecore from which the core derives
   * @returns {Wavecore} newCore - The new Wavecore
   */
  static fromCore(core, parent) {
    if (core instanceof Hypercore && parent instanceof this)
      return new this({ core, parent })
  }
  /**
   * Get new Wavecore from a raw audio asset - either its URI string or its
   * `Source` instance.
   * @arg {String|Source} rawFile - The raw audio file to copy from
   * @returns {Wavecore} newCore - The new Wavecore
   */
  static fromRaw(rawFile) {
    let source = null
    if (typeof rawFile == 'string') source = new Source(rawFile)
    if (rawFile instanceof Source) source = rawFile
    if (!source) return

    return new this({ source })
  }
  /**
   * The `Wavecore` class constructor.
   * @arg {Object} [opts={}] - Options for the class constructor.
   * @arg {Hypercore} [opts.core=null] - Provide a previously-made hypercore.
   * @arg {Integer} [opts.indexSize=null] - Declare alternate index size.
   * @arg {Source} [opts.source=null] - Provide `little-media-box` source.
   * @arg {random-access-storage} [opts.storage=ram] - Provide storage instance.
   * @returns {Wavecore}
   */
  constructor(
    opts = {
      core: null,
      indexSize: null,
      parent: null,
      source: null,
      storage: ram,
    }
  ) {
    this.core = null
    this.source = null
    // Declaring a specific storage supercedes defining a specific hypercore
    if (opts.storage) {
      this.core = new Hypercore(opts.storage, Wavecore.coreOpts())
    }
    const { core, indexSize, parent, source } = opts
    if (parent) {
      this.parent = parent
      this.source = parent.source
      if (core instanceof Hypercore) this.core = core
    } else {
      // Instantiate stream for appending WAV file data to hypercore
      if (source instanceof Source) this.source = source
      // Assign to a hypercore provided via constructor arguments
      if (core instanceof Hypercore) this.core = core
    }
    // If there is still no hypercore lets just make a sane default one
    if (!this.core) this.core = new Hypercore(ram, Wavecore.coreOpts())
    this.core.ready().then(
      process.nextTick(() => {
        this.replicator = new Replicator()
      })
    )
    this.indexSize = indexSize ? indexSize : INDEX_SIZE
  }
  /**
   * Get the Wavecore's discovery key so the hypercore can be found by others.
   * @returns {Buffer} discoveryKey
   */
  _discoveryKey() {
    return this.core.discoveryKey
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
    return this.core.createReadStream({ start, end })
  }
  /**
   * Append blank data to the tail of the wavecore. If no index count is
   * specified the function will add one index of blank data.
   * @async
   * @arg {Number} [n] - Number of indeces of blank data to append.
   */
  async addBlank(n) {
    try {
      let counter = n || 1
      while (counter > 0) {
        await this.core.append(Buffer.alloc(this.indexSize))
        counter--
      }
    } catch (err) {
      throw err
    }
  }
  /**
   * Add a Buffer of new data to the tail of the Wavecore.
   * @arg {Buffer} data
   * @returns {Number} index - The index number for the first block written.
   */
  async append(data) {
    try {
      const index = await this.core.append(data)
      return index
    } catch (err) {
      throw err
    }
  }
  /**
   * Join one or more wavecores to the end of this wavecore. Creates and returns
   * a new Wavecore instance with the concatenated results.
   * @arg {Wavecore[]} wavecores
   * @returns {Wavecore}
   */
  async concat(wavecores) {
    const allCores = [this, ...wavecores]
    const coreStreams = new MultiStream(
      allCores.map((c) => c.core.createReadStream())
    )
    const concatCore = new Hypercore(ram)
    await concatCore.ready()
    return new Promise((resolve, reject) => {
      try {
        const concatWriter = concatCore.createWriteStream()
        concatWriter.on('close', () => {
          resolve(Wavecore.fromCore(concatCore, this))
        })
        coreStreams.pipe(concatWriter)
      } catch (err) {
        reject(err)
      }
    })
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
  shift(index = 1) {
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
      if (Number(index) > this.core.length)
        reject(new Error('Index greater than core size!'))
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
   * Reads the source WAV into the class instance's Hypercore v10. Returns a
   * Promise, which resolves the Wavecore's hypercore instance.
   * @async
   * @arg {Object} [opts={}] - Options object.
   * @arg {Boolean} [opts.loadSamples=false] - Whether to load WAV samples into memory
   * @arg {Source} [opts.source=null] - Declare a `Source` before loading.
   * @returns {Hypercore} - The Hypercore v10 data structure
   */
  async toHypercore(opts = { source: null }) {
    const { source } = opts
    if (source instanceof Source) this.source = source
    try {
      await this.core.ready()
      await this.core.append(
        Buffer.from(
          JSON.stringify({
            sampleRate: 48000,
            depth: 16,
            encoding: 'signed',
            channels: 1,
          })
        )
      )

      return new Promise((resolve, reject) => {
        this.source.open((err) => {
          if (err) reject(err)
          // PassThrough will append each block received from readStream to hypercore
          const pt = new PassThrough()
          pt.on('error', (err) => reject(err))
          pt.on('data', async (d) => await this.core.append(d))
          pt.on('close', async () => {
            await this.core.update()
            resolve(this.core)
          })

          const rs = fs.createReadStream(this.source.pathname, {
            highWaterMark: this.indexSize,
          })
          rs.on('error', (err) => reject(err))

          rs.pipe(pt)
        })
      })
    } catch (err) {
      throw err
    }
  }
  /**
   * Add the Wavecore's hypercore to its Wavecore.replicator, seeding it to the
   * swarm via the Storyboard Sessions bootstrap servers.
   * @returns {Replicator} replicator - The replicator instance with added core
   */
  async replicate() {
    await this.replicator.add(this.core)
    return this.replicator
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
