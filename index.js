const abf = require('audio-buffer-from')
const abu = require('audio-buffer-utils')
const Hypercore = require('hypercore')
const Hyperswarm = require('hyperswarm')
const MultiStream = require('multistream')
const { PassThrough, Readable } = require('stream')
const ram = require('random-access-memory')

const WAVE_FORMAT = {
  bitDepth: 32,
  channels: 1,
  channelConfiguration: 'mono',
  encoding: 'floating-point',
  interleaved: false,
  rate: 44100,
  type: 'raw',
}
const INDEX_SIZE = 76800 // 800ms
// const INDEX_SIZE = 57600 // 600ms

/**
 * The `Wavecore` class provides a Hypercore v10 interface for working with WAV
 * audio files in a real-time, peer-to-peer context.
 * @class
 */
class Wavecore {
  /**
   * Get the default hypercore instantiation options with optional hypercore
   * opts applied
   * @arg {Object} [opts={}]
   * @arg {Buffer} [opts.encryptionKey=null]
   * @returns {Object} coreOpts
   */
  static coreOpts(opts = { encryptionKey: null }) {
    const { encryptionKey } = opts
    const baseOpts = {
      valueEncoding: 'binary',
      overwrite: true,
      createIfMissing: true,
    }
    if (encryptionKey) baseOpts.encryptionKey = encryptionKey
    return baseOpts
  }
  /**
   * Get new Wavecore from a previously-instantiated hypercore and its parent
   * Wavecore.
   * @arg {Wavecore} core - The Hypercore to copy from
   * @arg {Wavecore} [parent=null] - The Wavecore from which the core derives
   * @arg {Object} [opts={}] - Optional options object
   * @arg {Source} [opts.source=null] - The Source from which the core derives
   * @returns {Wavecore} newCore - The new Wavecore
   */
  static fromCore(core, parent, opts = { source: null }) {
    const { source } = opts
    if (core instanceof Hypercore) return new this({ core, parent, source })
  }
  static fromStream(st) {
    const w = new this({ source: st })
    w.recStream(st)
    return w
  }
  /**
   * The `Wavecore` class constructor.
   * @arg {Object} [opts={}] - Options for the class constructor.
   * @arg {Hypercore} [opts.core=null] - Provide a previously-made hypercore.
   * @arg {Integer} [opts.indexSize=null] - Declare alternate index size.
   * @arg {Source} [opts.source=null] - Provide `little-media-box` source.
   * @arg {Buffer} [opts.encryptionKey=null] - Provide an optional encryption key.
   * @arg {random-access-storage} [opts.storage=ram] - Provide storage instance.
   * @returns {Wavecore}
   */
  constructor(
    opts = {
      core: null,
      ctx: null,
      encryptionKey: null,
      indexSize: null,
      parent: null,
      source: null,
      storage: null,
    }
  ) {
    this.core = null
    this.ctx = null
    this.source = null
    let storage = null
    // Declaring a specific storage supercedes defining a specific hypercore
    if (opts.storage) {
      storage = opts.storage
    } else {
      storage = ram
    }
    const { core, ctx, encryptionKey, indexSize, parent, source } = opts
    if (ctx) this.ctx = ctx
    if (parent) {
      this.parent = parent
      this.source = parent.source || null
      if (core instanceof Hypercore) this.core = core
    } else {
      if (source)
        this.source =
          source instanceof Buffer ||
          source instanceof Readable ||
          source instanceof PassThrough
            ? source
            : Buffer.from(source)
      // Assign to a hypercore provided via constructor arguments
      if (core instanceof Hypercore) this.core = core
    }
    // If there is still no hypercore lets just make a sane default one
    if (!this.core)
      this.core = new Hypercore(storage, Wavecore.coreOpts({ encryptionKey }))
    this.core.ready().then(
      process.nextTick(() => {
        this.indexSize = indexSize ? indexSize : INDEX_SIZE
        this.tags = new Map()
      })
    )
  }
  /**
   * Returns a Promise which resolves the `AudioBuffer` of the PCM data in the
   * Wavecore's hypercore instance.
   * @arg {Object} [opts={}] - Options object
   * @arg {Boolean} [opts.dcOffset=true] - Whether to apply DC offset to the
   * signal. (Recommended)
   * @arg {Boolean} [opts.normalize=false] - Normalize the audio
   * @arg {Boolean} [opts.store=false] - Store the audioBuffer in the class
   * instance
   * @arg {AudioBuffer|Boolean} [opts.mix=false] - An `AudioBuffer` to mix in to
   * the resulting output
   * @arg {Number} [opts.start=0] - Index to start from.
   * @arg {Number} [opts.end=-1] - Index to end on.
   * @returns {AudioBuffer}
   * @see {@link
   * https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer|AudioBuffer -
   * MDN}
   */
  async audioBuffer(
    opts = {
      dcOffset: true,
      mix: false,
      normalize: false,
      start: 0,
      end: -1,
      store: false,
    }
  ) {
    const { dcOffset, mix, normalize, start, end, store } = opts
    const bufs = []
    const rs = this._rawStream(start || 0, end || -1)
    rs.on('data', (d) => bufs.push(d))

    const prom = new Promise((resolve, reject) => {
      rs.on('end', () => {
        try {
          let audioBuffer = abf(Buffer.concat(bufs), 'mono float32 le 44100')
          if (dcOffset) audioBuffer = abu.removeStatic(audioBuffer)
          if (normalize) audioBuffer = abu.normalize(audioBuffer)
          if (mix) audioBuffer = abu.mix(audioBuffer, mix)
          if (store) this.audioBuffer = audioBuffer
          resolve(audioBuffer)
        } catch (err) {
          reject(err)
        }
      })
    })
    return await Promise.resolve(prom)
  }
  /**
   * Get the Wavecore's discovery key so the hypercore can be found by others.
   * @returns {Buffer} discoveryKey
   * @see {@link
   * https://github.com/hypercore-protocol/hypercore#feeddiscoverykey|discoveryKey}
   */
  get discoveryKey() {
    return this.core.discoveryKey
  }
  /**
   * Return the fork ID of the Wavecore.
   * @returns {Number} forkId
   */
  get fork() {
    return this.core.fork
  }
  /**
   * Returns an `Object` with the public and secret keys for the Wavecore.
   * @returns {Object} keyPair
   */
  get keyPair() {
    return this.core.keyPair
  }
  /**
   * Returns the byte length of the last index in the hypercore. This is useful
   * when it is known that the last index does not contain a buffer that matches
   * the declared `indexSize` of the Wavecore.
   */
  get lastIndexSize() {
    return this.core.byteLength - (this.core.length - 1) * this.indexSize
  }
  /**
   * Returns the current length of the Wavecore's hypercore.
   * @returns {Number} length
   */
  get length() {
    return this.core.length
  }
  /**
   * Returns a `Readable` stream that continually reads for appended data. A
   * good way to listen for live changes to the Wavecore.
   * @returns {Readable} liveStream
   */
  get liveStream() {
    return this.core.createReadStream({ live: true, snapshot: false })
  }
  /**
   * Returns the index number and relative byte offset of the next zero-crossing
   * audio sample after the specified byte length. Useful to find the correct
   * place to make an audio edit without causing any undesirable audio
   * artifacts.
   * @arg {Number|Array} byteLength - The byteLength from which to start the search. (Can also be an array as returned by the seek method.)
   * @returns {Array} nextZ - Array containing the index number and relative byte
   * offset of the next zero crossing in the audio data.
   * @see {@link https://en.wikipedia.org/wiki/Zero_crossing|Zero Crossing}
   */
  async _nextZero(b) {
    let sv = b
    if (b instanceof Array) sv = b[0] * this.indexSize + b[1]
    const [i, rel] = await this.core.seek(sv)
    const idData = await this.core.get(i)
    const idArr = Array.from(idData)
    const nextZ = idArr.indexOf(0, rel)
    return [i, nextZ]
  }
  /**
   * Returns a `ReadStream` of the source audio file via its Hypercore v10 data
   * structure. Can indicate a custom range to only grab a portion of the file
   * as a readable stream.
   * @arg {Number} [start=0] - Index from which to start the stream
   * @arg {Number} [end=-1] - Index where the stream should end.
   * @returns {Readable} readStream
   */
  _rawStream(start = 0, end = -1) {
    return this.core.createReadStream(
      { start, end },
      { highWaterMark: this.indexSize }
    )
  }
  /**
   * Get a list of the sessions on this Wavecore's hypercore.
   */
  get sessions() {
    return this.core.sessions
  }
  /**
   * Append blank data to the tail of the wavecore. If no index count is
   * specified the function will add one index of blank data.
   * @async
   * @arg {Number} [n] - Number of indeces of blank data to append.
   */
  async addBlank(n) {
    if (n == 0) return
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
   * Classify the type of audio data. Currently supports dynamics
   * classification, i.e., whether the audio is quiet or a voice.
   * @arg {Number} i - Index number to classify
   * @arg {Object} [opts={}] - Options object
   * @arg {Boolean} [opts.dynamics=true] - Enable dynamics classification
   * @returns {String}
   */
  async classify(i, opts = { dynamics: true }) {
    function dyn(indexData) {
      const id = Array.from(indexData)
      return id.filter((i) => i === 0).length / id.length > 0.2
        ? 'quiet'
        : 'voice'
    }
    const data = await this.core.get(i)
    const { dynamics } = opts
    if (dynamics) return dyn(data)
    return
  }
  /**
   * Completely close the Wavecore's underlying Hypercore, making it immutable.
   * If a Wavecore's hypercore is closed, it cannot have any further work done
   * to it and its data cannot be accessed.
   * @async
   * @returns {Promise}
   */
  async close() {
    if (this.core.closing) return
    await this.core.close()
    return new Promise((resolve, reject) => {
      if (!this.core.closed) {
        reject('could not close hypercore!')
      }
      resolve(true)
    })
  }
  /**
   * Join one or more wavecores to the end of this wavecore. Creates and returns
   * a new Wavecore instance with the concatenated results.
   * @arg {Wavecore[]} wavecores
   * @returns {Wavecore}
   */
  async concat(wavecores) {
    try {
      const allCores = [this, ...wavecores]
      const coreStreams = new MultiStream(allCores.map((c) => c._rawStream()))
      const concatCore = new Hypercore(ram)
      const prom = new Promise((resolve, reject) => {
        const concatWriter = concatCore.createWriteStream()
        concatWriter.on('close', () => {
          resolve(Wavecore.fromCore(concatCore, this))
        })
        coreStreams.pipe(concatWriter)
      })
      return await Promise.resolve(prom)
    } catch (err) {
      throw err
    }
  }
  /**
   * Check if the Wavecore has the block at the provided index number.
   * @arg {Number} i - The index number to check for
   * @returns {Boolean} - Does the wavecore have that index?
   */
  async has(i) {
    try {
      return await this.core.has(i)
    } catch (err) {
      throw err
    }
  }
  /**
   * Reads the source WAV into the class instance's Hypercore v10.
   * @async
   * @arg {Object} [opts={}] - Options object.
   * @arg {Source} [opts.source=null] - Declare a `Source` before loading.
   * @returns {Hypercore} - The Hypercore v10 data structure
   * @see {@link https://github.com/hypercore-protocol/hypercore|Hypercore}
   */
  async open(opts = { source: null }) {
    if (this.core.length > 0 && this.core.opened) return

    const { source } = opts

    try {
      if (!source && !this.source) throw new Error('No usable source!')
      await this.core.ready()
      this.waveFormat = Buffer.from(JSON.stringify(WAVE_FORMAT))

      const srcArr = Array.from(source || this.source || null)

      for (let i = 0; i < srcArr.length; i += this.indexSize) {
        await this.core.append(Buffer.from(srcArr.slice(i, i + this.indexSize)))
      }

      await this.core.update()
      return this.core
    } catch (err) {
      throw err
    }
  }
  /**
   * Record a stream of data into the Wavecore's hypercore.
   * @arg {Stream} st - The stream to record into the Wavecore.
   */
  recStream(st, opts = { indexSize: null }) {
    if (!st) return
    const { indexSize } = opts
    const pt = new PassThrough({
      highWaterMark: Number(indexSize) || this.indexSize,
    })
    const ws = this.core.createWriteStream({ highWaterMark: this.indexSize })
    st.pipe(pt).pipe(ws)
    if (this.source === null) this.source = st
    return
  }
  /**
   * Returns index and byte position of a byte offset.
   * @async
   * @arg {Number} byteOffset - Number of bytes to seek from beginning of file
   * @returns {Array} seekData - `[index, relativeOffset]`
   */
  async seek(byteOffset, opts = { zero: false }) {
    try {
      const sa = []
      const [index, relativeOffset] = await this.core.seek(byteOffset)
      sa.push(index, relativeOffset)
      if (opts.zero) {
        const zeroCross = await this._nextZero(byteOffset)
        const bs = zeroCross[0] * this.indexSize + zeroCross[1]
        sa.push(bs)
      }
      return sa
    } catch (err) {
      console.error(err)
      return
    }
  }
  /**
   * Start a new `session` for this Wavecore.
   */
  session() {
    return this.core.session()
  }
  /**
   * Snapshot the current session and begin a new one.
   * @returns {Wavecore} - A new Wavecore to continue working from
   */
  snapshot() {
    return Wavecore.fromCore(this.core.snapshot(), this)
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
      ptTail.on('error', (err) => reject(err))
      ptTail.on('data', (d) => tailCore.append(d))
      ptTail.on('close', async () => {
        try {
          const headStream = this.core.createReadStream({
            start: 0,
            end: index,
          })
          const ptHead = new PassThrough()
          ptHead.on('error', (err) => reject(err))
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
   * Set the Wavecore's RIFF tags, written to the wave file once it's closed.
   * @arg {String} id - The four-character RIFF tag ID
   * @arg {String} value - The string value to assign the RIFF tag.
   * @see {@link https://exiftool.org/TagNames/RIFF.html|RIFF Tags}
   */
  tag(id, value) {
    try {
      this.tags.set(`${id}`, `${value}`)
      return
    } catch (err) {
      console.error(err)
      return err
    }
  }
  /**
   * Truncate the Hypercore to a shorter length.
   * @async
   * @arg {Number} length - The new length. Must be shorter than current length.
   * @arg {Object} [opts={}] - Optional options object
   * @arg {Boolean} [opts.snapshot=false] - Whether to snapshot the Wavecore
   * before truncation occurs. This is recommended if you may want to undo this
   * operation later on.
   */
  async truncate(length, opts = { snapshot: false }) {
    try {
      if (!length || !length instanceof Number) return
      if (length > this.core.length) throw new Error('Must be a shorter length')
      if (opts.snapshot) this.snapshot()
      return await this.core.truncate(length)
    } catch (err) {
      console.error(err)
    }
  }
}

module.exports = Wavecore
