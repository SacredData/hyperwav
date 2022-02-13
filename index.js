const abf = require('audio-buffer-from')
const fs = require('fs')
const Hypercore = require('hypercore')
const MultiStream = require('multistream')
const nanoprocess = require('nanoprocess')
const { PassThrough, Readable } = require('stream')
const process = require('process')
const ram = require('random-access-memory')
const { Source } = require('@storyboard-fm/little-media-box')

const WAVE_FORMAT = {
  bitDepth: 16,
  channels: 1,
  encoding: 'signed',
  rate: 48000,
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
   * @arg {Wavecore} [parent=null] - The Wavecore from which the core derives
   * @arg {Object} [opts={}] - Optional options object
   * @arg {Source} [opts.source=null] - The Source from which the core derives
   * @returns {Wavecore} newCore - The new Wavecore
   */
  static fromCore(core, parent, opts = { source: null }) {
    const { source } = opts
    if (core instanceof Hypercore) return new this({ core, parent, source })
  }
  /**
   * Get new Wavecore from a raw audio asset - either its URI string or its
   * `Source` instance.
   * @arg {String|Source} rawFile - The raw audio file to copy from
   * @returns {Wavecore} newCore - The new Wavecore
   */
  static fromRaw(rawFile, opts = { indexSize: null }) {
    let source = null
    const { indexSize } = opts

    if (typeof rawFile == 'string') source = new Source(rawFile)
    if (rawFile instanceof Source) source = rawFile
    if (!source) return

    return new this({ source, indexSize })
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
      this.source = Source.from(parent.source) || null
      if (core instanceof Hypercore) this.core = core
    } else {
      // Instantiate stream for appending WAV file data to hypercore
      if (source instanceof Source) this.source = Source.from(source)
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
  _audioBuffer() {
    return new Promise((resolve, reject) => {
      const bufs = []
      const rs = this.core.createReadStream()
      const pt = new PassThrough()
      pt.on('data', (d) => bufs.push(d))
      pt.on('error', (err) => reject(err))
      pt.on('end', () => {
        const audioBuffer = abf(Buffer.concat(bufs), 'stereo buffer le 48000')
        resolve(audioBuffer)
      })
      rs.pipe(pt)
    })
  }
  /**
   * Get the Wavecore's discovery key so the hypercore can be found by others.
   * @returns {Buffer} discoveryKey
   * @see {@link
   * https://github.com/hypercore-protocol/hypercore#feeddiscoverykey|discoveryKey}
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
   * Returns the byte length of the last index in the hypercore. This is useful
   * when it is known that the last index does not contain a buffer that matches
   * the declared `indexSize` of the Wavecore.
   */
  _lastIndexSize() {
    return this.core.byteLength - (this.core.length - 1) * this.indexSize
  }
  /**
   * Returns the current length of the Wavecore's hypercore.
   * @returns {Number} length
   */
  _length() {
    return this.core.length
  }
  /**
   * Returns a `Readable` stream that continually reads for appended data. A
   * good way to listen for live changes to the Wavecore.
   * @returns {Readable} liveStream
   */
  _liveStream() {
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
   * @arg {Number} [start=1] - Index from which to start the stream
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
   * Get the maximum volume adjustment value for the Wavecore's PCM audio data.
   * Used by the `norm()` method to ensure the normalized audio does not clip.
   * @returns {Number} vol - The SoX `vol -v` value.
   */
  _volAdjust() {
    return new Promise((resolve, reject) => {
      const statsCmd = nanoprocess('sox', [
        '-r',
        '48000',
        '-b',
        '16',
        '-e',
        'signed',
        '-t',
        'raw',
        '-',
        '-n',
        'stat',
        '-v',
      ])
      statsCmd.open((err) => {
        if (err) throw err

        const statsOut = []

        const pt = new PassThrough()
        pt.on('data', (d) => statsOut.push(`${d}`))

        statsCmd.on('close', (code) => {
          if (code !== 0) reject(new Error('Non-zero exit code'))
          resolve(Number(statsOut.join('')))
        })
        statsCmd.stderr.pipe(pt)

        let rs = this.core.createReadStream()
        rs.pipe(statsCmd.stdin)
      })
    })
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
  concat(wavecores) {
    const allCores = [this, ...wavecores]
    const coreStreams = new MultiStream(allCores.map((c) => c._rawStream()))
    const concatCore = new Hypercore(ram)
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
   * Normalize the audio data in the Wavecore. Returns a new Wavecore instance.
   */
  norm() {
    return new Promise((resolve, reject) => {
      this._volAdjust().then((vol) => {
        const normCmd = nanoprocess('sox', [
          '-r',
          '48000',
          '-b',
          '16',
          '-e',
          'signed',
          '-t',
          'raw',
          '-',
          '-t',
          'raw',
          '-',
          'vol',
          vol,
        ])
        normCmd.open((err) => {
          if (err) throw err

          // TODO figure out why number of indeces higher in new wavecore
          const newCore = new Hypercore(ram)

          const pt = new PassThrough()
          pt.on('data', (d) => newCore.append(d))

          normCmd.on('close', (code) => {
            if (code !== 0) reject(new Error('Non-zero exit code'))
            resolve(Wavecore.fromCore(newCore, this))
          })
          normCmd.stdout.pipe(pt)

          let rs = this._rawStream()
          rs.pipe(normCmd.stdin)
        })
      })
    })
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
    const { source } = opts
    if (source instanceof Source) this.source = Source.from(source)
    try {
      await this.core.ready()
      this.waveFormat = Buffer.from(JSON.stringify(WAVE_FORMAT))

      for await (const block of fs.createReadStream(this.source.pathname, {
        highWaterMark: this.indexSize,
      })) {
        await this.core.append(block)
      }

      await this.core.update()
      return this.core
    } catch (err) {
      throw err
    }
  }
  /**
   * Play the raw Wavecore PCM audio via a nanoprocess
   * @arg {nanoprocess} [np=null] - Optional custom nanoprocess for playback
   * @see {@link https://github.com/little-core-labs/nanoprocess nanoprocess}
   */
  play(np) {
    let proc = null

    if (np) {
      proc = np
    } else {
      proc = nanoprocess('play', [
        '-r',
        '48000',
        '-b',
        '16',
        '-e',
        'signed',
        '-t',
        'raw',
        '-',
      ])
    }

    if (!proc) throw new Error('nanoprocess didnt work wtf')
    const rs = this._rawStream()

    proc.open((err) => {
      if (err) throw err
      rs.on('end', () => console.log('ended'))
      proc.stderr.pipe(process.stderr)
      proc.stdout.pipe(process.stdout)
      rs.pipe(proc.stdin)
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
   * Start a new `session` for this Wavecore.
   */
  session() {
    return this.core.session()
  }
  /**
   * Get a list of the sessions on this Wavecore's hypercore.
   */
  sessions() {
    return this.core.sessions
  }
  /**
   * Snapshot the current session and begin a new one.
   */
  snapshot() {
    return this.core.snapshot()
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
   * Runs `sox -n stats` on the raw audio in the Wavecore, via a nanoprocess.
   * @arg {Object} [opts={}] - Optional opts object for declaring index
   * @arg {Number} [opts.index=null] - Declare index to get stats on
   * @returns {Promise} statsOut - The string of stats information returned by
   * SoX
   */
  stats(opts = { index: null }) {
    return new Promise((resolve, reject) => {
      const { index } = opts
      const statsCmd = nanoprocess('sox', [
        '-r',
        '48000',
        '-b',
        '16',
        '-e',
        'signed',
        '-t',
        'raw',
        '-',
        '-n',
        'stats',
        'stat',
      ])
      statsCmd.open((err) => {
        if (err) throw err

        const statsOut = []

        const pt = new PassThrough()
        pt.on('data', (d) => statsOut.push(`${d}`))

        statsCmd.on('close', (code) => {
          if (code !== 0) reject(new Error('Non-zero exit code'))
          resolve(statsOut.join(''))
        })
        statsCmd.stderr.pipe(pt)

        let rs = null

        if (index !== null) {
          rs = this._rawStream(index, index + 1)
        } else {
          rs = this.core.createReadStream()
        }

        rs.pipe(statsCmd.stdin)
      })
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
   * Increase or decrease playback speed of audio samples, without changing the
   * pitch of the audio itself. Returns a new Wavecore containing the
   * time-stretched samples.
   * @arg {Float} f - The new tempo factor. 0.9 = slow down by 10%; 1.1 = faster
   * by 10%.
   * @returns {Promise} stretchedCore - The new time-stretched Wavecore.
   */
  tempo(f) {
    return new Promise((resolve, reject) => {
      const tempoCmd = nanoprocess('sox', [
        '-r',
        '48000',
        '-b',
        '16',
        '-e',
        'signed',
        '-t',
        'raw',
        '-',
        '-t',
        'raw',
        '-',
        'tempo',
        '-s',
        `${f}`,
      ])
      tempoCmd.open((err) => {
        if (err) throw err

        // TODO figure out why number of indeces higher in new wavecore
        const newCore = new Hypercore(ram)

        const pt = new PassThrough()
        pt.on('data', (d) => newCore.append(d))

        tempoCmd.on('close', (code) => {
          if (code !== 0) reject(new Error('Non-zero exit code'))
          resolve(Wavecore.fromCore(newCore, this))
        })
        tempoCmd.stdout.pipe(pt)

        let rs = this.core.createReadStream()
        rs.pipe(tempoCmd.stdin)
      })
    })
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
  /**
   * Returns a `Promise` which resolves a `Buffer` of a PCM WAV file. Requires
   * `sox` in PATH.
   * @arg {Object} [opts={}] - Optional options object
   * @arg {Boolean} [opts.store=false] - Whether to store the wav as a buffer in
   * the Wavecore class instance.
   * @returns {Promise} wavBuf - WAV file Buffer
   */
  wav(opts={store:false}) {
    const { store } = opts
    return new Promise((resolve, reject) => {
      const bufs = []
      const pt = new PassThrough()
      pt.on('error', (err) => reject(err))
      pt.on('data', (d) => bufs.push(d))
      const soxCmd = nanoprocess('sox', [
        '-r',
        '48000',
        '-b',
        '16',
        '-e',
        'signed',
        '-t',
        'raw',
        '-',
        '-t',
        'wav',
        '-',
      ])
      soxCmd.open((err) => {
        if (err) reject(err)

        soxCmd.on('close', (code) => {
          const wavBuf = Buffer.concat(bufs)
          if (store) this.wavBuffer = wavBuf
          resolve(wavBuf)
        })
        soxCmd.stdout.pipe(pt)
        const rs = this.core.createReadStream()
        rs.pipe(soxCmd.stdin)
      })
    })
  }
}

module.exports = Wavecore
