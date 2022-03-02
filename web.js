const abf = require('audio-buffer-from')
const abu = require('audio-buffer-utils')
const b4a = require('b4a')
const Hypercore = require('hypercore')
const Hyperswarm = require('hyperswarm')
const MultiStream = require('multistream')
const { PassThrough, Readable } = require('stream')
const ram = require('random-access-memory')

const WAVE_FORMAT = {
  bitDepth: 32,
  channels: 1,
  encoding: 'floating-point',
  rate: 44100,
  type: 'buffer',
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
   * Get the default hypercore instantiation options
   * @returns {Object} coreOpts
   */
  static coreOpts() {
    return { valueEncoding: 'binary', overwrite: true, createIfMissing: true }
  }
  static fromStream(st) {
    const w = new Wavecore({ source: st })
    w.recStream(st)
    return w
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
      storage: null,
    }
  ) {
    this.core = null
    this.source = null
    let storage = null
    // Declaring a specific storage supercedes defining a specific hypercore
    if (opts.storage) {
      storage = opts.storage
    } else {
      storage = ram
    }
    const { core, indexSize, parent, source } = opts
    if (parent) {
      this.parent = parent
      if (core instanceof Hypercore) this.core = core
    } else {
      // Instantiate stream for appending WAV file data to hypercore
      if (source) this.source = source
      // Assign to a hypercore provided via constructor arguments
      if (core instanceof Hypercore) this.core = core
    }
    // If there is still no hypercore lets just make a sane default one
    if (!this.core) this.core = new Hypercore(storage, Wavecore.coreOpts())
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
   * @returns {Promise} - Promise resolving with the AudioBuffer data
   * @see {@link
   * https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer|AudioBuffer -
   * MDN}
   */
  async audioBuffer(opts = { dcOffset: true, normalize: false, store: false }) {
    const { dcOffset, normalize, store } = opts
    const bufs = []
    const rs = this.core.createReadStream()
    const pt = new PassThrough()
    pt.on('data', (d) => bufs.push(d))
    const prom = new Promise((resolve, reject) => {
      pt.on('error', (err) => reject(err))
      pt.on('end', () => {
        let audioBuffer = abf(Buffer.concat(bufs), 'mono buffer float32 le 44100')
        if (dcOffset) audioBuffer = abu.removeStatic(audioBuffer)
        if (normalize) audioBuffer = abu.normalize(audioBuffer)
        if (store) this.audioBuffer = audioBuffer
        resolve(audioBuffer)
      })
      rs.pipe(pt)
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
   * @arg {Number} byteLength - The byteLength from which to start the search
   * @returns {Array} nextZ - Array containing the index number and relative byte
   * offset of the next zero crossing in the audio data.
   * @see {@link https://en.wikipedia.org/wiki/Zero_crossing|Zero Crossing}
   */
  async _nextZero(b) {
    const [i, rel] = await this.core.seek(b)
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
   * Record a stream of data into the Wavecore's hypercore.
   * @arg {Stream} st - The stream to record into the Wavecore.
   */
  recStream(st) {
    if (!st) return
    const ws = this.core.createWriteStream({
      highWaterMark: this.indexSize || INDEX_SIZE
    })
    ws.on('close', () => {
      return
    })
    st.pipe(ws)
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
  split(index, opts = { zeroCross: false }) {
    const zeroCross = { opts }
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
    if (!length || !length instanceof Number) return
    if (length > this.core.length) throw new Error('Must be a shorter length')
    if (opts.snapshot) await this.snapshot()
    await this.core.truncate(length)
    return
  }
}

module.exports = Wavecore
