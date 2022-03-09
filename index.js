const abf = require('audio-buffer-from')
const abu = require('audio-buffer-utils')
const Hypercore = require('hypercore')
const Hyperswarm = require('hyperswarm')
const MultiStream = require('multistream')
const nanoprocess = require('nanoprocess')
const { PassThrough, Readable } = require('stream')
const process = require('process')
const ram = require('random-access-memory')
const WaveFile = require('wavefile').WaveFile

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
      encryptionKey: null,
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
    const { core, encryptionKey, indexSize, parent, source } = opts
    if (parent) {
      this.parent = parent
      this.source = parent.source || null
      if (core instanceof Hypercore) this.core = core
    } else {
      if (source)
        this.source = source instanceof Buffer ||
          source instanceof Readable ||
          source instanceof PassThrough ?
            source :
            Buffer.from(source)
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
      store: false,
    }
  ) {
    const { dcOffset, mix, normalize, store } = opts
    const bufs = []
    const rs = this._rawStream()
    rs.on('data', (d) => bufs.push(d))
    const prom = new Promise((resolve, reject) => {
      rs.on('end', () => {
        try {
          let audioBuffer = abf(
            Buffer.concat(bufs),
            'mono buffer uint16 le 48000'
          )
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
   * Get the maximum volume adjustment value for the Wavecore's PCM audio data.
   * Used by the `norm()` method to ensure the normalized audio does not clip.
   * @arg {Object} [opts={}] - Optional options object
   * @arg {Number} [opts.start=0] - Index from which to start the stream
   * @arg {Number} [opts.end=-1] - Index where the stream should end.
   * @returns {Number} vol - The SoX `vol -v` value.
   */
  _volAdjust(opts = { start: 0, end: -1 }) {
    const { start, end } = opts
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
        if (err) reject(err)

        const statsOut = []

        const pt = new PassThrough()
        pt.on('data', (d) => statsOut.push(`${d}`))

        statsCmd.on('close', (code) => {
          if (code !== 0) reject(new Error('Non-zero exit code'))
          resolve(Number(statsOut.join('')))
        })
        statsCmd.stderr.pipe(pt)

        this._rawStream(start, end).pipe(statsCmd.stdin)
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
   * Apply gain attenuation or amplification to the Wavecore audio.
   * @arg {String} g - A string beginning with `+` or `-` indicating gain
   * operation to perform on the audio, i.e., `+8` or `-2.3`.
   * @arg {Object} [opts={}] - Optional options object
   * @arg {Number} [opts.start=0] - Start index
   * @arg {Number} [opts.end=-1] - End index
   * @arg {Boolean} [opts.limiter=false] - Whether to apply a limiter to the
   * gain function to prevent clipping.
   * @returns {Wavecore} - New Wavecore with the gain processing applied.
   */
  async gain(g, opts = { start: 0, end: -1, limiter: false }) {
    const { start, end, limiter } = opts
    const rs = this._rawStream(start, end)
    const cmdOpts = [
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
      'gain',
    ]
    if (limiter) cmdOpts.push('-l')
    cmdOpts.push(`${g}`)

    const gainCmd = nanoprocess('sox', cmdOpts)

    const prom = new Promise((resolve, reject) => {
      gainCmd.open((err) => {
        if (err) reject(err)

        const newGainCore = new Hypercore(ram)
        const ws = newGainCore.createWriteStream({
          highWaterMark: this.indexSize,
        })
        ws.on('close', () => {
          newGainCore
            .update()
            .then(() => resolve(Wavecore.fromCore(newGainCore, this)))
        })
        gainCmd.stdout.pipe(ws)
        rs.pipe(gainCmd.stdin)
      })
    })

    return await Promise.resolve(prom)
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
   * Listen live to the audio data coming in to the Wavecore. Great way to
   * monitor the audio inputs or broadcast the content to others.
   */
  monitor() {
    const cmdOpts = [
      '-r',
      '48000',
      '-b',
      '16',
      '-e',
      'signed',
      '-t',
      'raw',
      '-',
    ]
    const playCmd = nanoprocess('play', cmdOpts)
    playCmd.open((err) => {
      playCmd.stdout.pipe(process.stdout)
      this.liveStream.pipe(playCmd.stdin)
    })
  }
  /**
   * Normalize the audio data in the Wavecore. Returns a new Wavecore instance.
   * @arg {Object} [opts={}] - Optional options object
   * @arg {Number} [opts.start=0] - Index from which to start the stream
   * @arg {Number} [opts.end=-1] - Index where the stream should end.
   */
  async norm(opts = { start: 0, end: -1 }) {
    const { start, end } = opts
    try {
      const vol = await this._volAdjust({ start, end })
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

      const rs = this._rawStream(start, end)

      const prom = new Promise((resolve, reject) => {
        normCmd.open((err) => {
          if (err) reject(err)

          // TODO figure out why number of indeces higher in new wavecore
          const newCore = new Hypercore(ram)

          const pt = new PassThrough({ highWaterMark: this.indexSize })
          pt.on('error', (err) => reject(err))
          pt.on('data', (d) => newCore.append(d))

          normCmd.on('close', (code) => {
            if (code !== 0) reject(new Error('Non-zero exit code'))
            resolve(Wavecore.fromCore(newCore, this))
          })
          normCmd.stdout.pipe(pt)

          rs.pipe(normCmd.stdin)
        })
      })
      return await Promise.resolve(prom)
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
   * Play the raw Wavecore PCM audio via a nanoprocess
   * @arg {Object} [opts={}] - Optional options object
   * @arg {Number} [opts.start=0] - Start index
   * @arg {Number} [opts.end=-1] - End index
   * @arg {nanoprocess} [opts.np=null] - Declare a custom nanoprocess for playback
   * @see {@link https://github.com/little-core-labs/nanoprocess nanoprocess}
   */
  play(opts = { start: 0, end: -1, np: null }) {
    const { np, start, end } = opts

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
    const rs = this._rawStream(start, end)

    proc.open((err) => {
      if (err) throw err
      rs.on('end', () => console.log('ended'))
      proc.stderr.pipe(process.stderr)
      proc.stdout.pipe(process.stdout)
      rs.pipe(proc.stdin)
    })
  }
  /** Record into the Wavecore via the `rec` CLI application.
   * @arg {String} [dur="30:00"] - Duration string for recording; defaults to
   * 30min.
   */
  async _rec(dur = '30:00') {
    const cmdOpts = [
      '-r',
      '48000',
      '-c',
      '1',
      '-b',
      '16',
      '-e',
      'signed-integer',
      '-t',
      'raw',
      '-',
      'trim',
      '0',
      `${dur}`,
    ]
    const recCmd = nanoprocess('rec', cmdOpts)
    const prom = new Promise((resolve, reject) => {
      recCmd.open((err) => {
        if (err) reject(err)

        recCmd.on('close', (code) => {
          if (code !== 0) reject(new Error('Non-Zero exit code!', code))

          this.core.update().then(() => resolve())
        })

        recCmd.stdout.pipe(
          this.core.createWriteStream({ highWaterMark: this.indexSize })
        )
      })
    })

    await Promise.resolve(prom)
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
   * Runs `sox -n stats` on the raw audio in the Wavecore, via a nanoprocess.
   * @async
   * @arg {Object} [opts={}] - Optional opts object for declaring index
   * @arg {Number} [opts.index=null] - Declare index to get stats on
   * @returns {String} statsOut - The string of stats information returned by
   * SoX
   */
  async stats(opts = { index: null }) {
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

    const statsOut = []

    const pt = new PassThrough()
    pt.on('data', (d) => statsOut.push(`${d}`))
    const prom = new Promise((resolve, reject) => {
      statsCmd.open((err) => {
        if (err) reject(err)

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
    return await Promise.resolve(prom)
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
   * @arg {Object} [opts={}] - Optional options object
   * @arg {Boolean} [opts.stats=false] - Whether to also get SoX stats on the
   * time-stretched audio data. Currently these stats are output to `stdout`.
   * Useful for getting the new Wavecore's audio duration.
   * @returns {Wavecore} stretchedCore - The new time-stretched Wavecore.
   */
  async tempo(f, opts = { stats: false }) {
    const { stats } = opts
    const cmdOpts = [
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
    ]
    if (stats) cmdOpts.push('stats')
    const tempoCmd = nanoprocess('sox', cmdOpts)
    const prom = new Promise((resolve, reject) => {
      tempoCmd.open((err) => {
        if (err) reject(err)

        const newCore = new Hypercore(ram)

        const pt = new PassThrough()
        pt.on('data', (d) => newCore.append(d))

        tempoCmd.on('close', (code) => {
          if (code !== 0) reject(new Error('Non-zero exit code'))
          resolve(Wavecore.fromCore(newCore, this))
        })
        tempoCmd.stdout.pipe(pt)
        if (stats) tempoCmd.stderr.pipe(process.stdout)

        let rs = this._rawStream()
        rs.pipe(tempoCmd.stdin)
      })
    })
    return await Promise.resolve(prom)
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
  /**
   * Runs `sox vad` on the Wavecore audio. Trims excessive silence from the
   * front of voice recordings.
   * @returns {Wavecore}
   */
  async vad() {
    const cmdOpts = [
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
      'vad',
    ]
    const cmd = nanoprocess('sox', cmdOpts)
    const newCore = new Hypercore(ram)
    const normCore = await this.norm()
    const prom = new Promise((resolve, reject) => {
      cmd.open((err) => {
        if (err) reject(err)

        cmd.on('close', (code) => {
          if (code !== 0) reject(new Error('Non-zero exit!', code))
          resolve(Wavecore.fromCore(newCore, this))
        })

        cmd.stdout.pipe(
          newCore.createWriteStream({ highWaterMark: this.indexSize })
        )
        normCore._rawStream().pipe(cmd.stdin)
      })
    })
    return await Promise.resolve(prom)
  }
  /**
   * Returns a `Promise` which resolves a `Buffer` of a PCM WAV file. Requires
   * `sox` in PATH.
   * @arg {Object} [opts={}] - Optional options object
   * @arg {Boolean} [opts.store=false] - Whether to store the wav as a buffer in
   * the Wavecore class instance.
   * @returns {Buffer} wavBuf - WAV file Buffer
   */
  async wav(opts = { store: false }) {
    const { store } = opts
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
    const np = new Promise((resolve, reject) => {
      soxCmd.open((err) => {
        if (err) reject(err)

        soxCmd.on('close', (code) => {
          if (code !== 0) reject(new Error('Non-Zero exit-code!', code))
          const wavBuf = Buffer.concat(bufs)
          if (store) this.wavBuffer = wavBuf
          if (this.wavBuffer) this.wavFile = new WaveFile(this.wavBuffer)
          if (this.wavFile) {
            Array.from(this.tags).forEach((t) =>
              this.wavFile.setTag(t[0], t[1])
            )
            this.wavBuffer = Buffer.from(this.wavFile.toBuffer())
          }
          resolve(wavBuf)
        })
        soxCmd.stdout.pipe(pt)
        const rs = this.core.createReadStream()
        rs.pipe(soxCmd.stdin)
      })
    })
    return await Promise.resolve(np)
  }
}

module.exports = Wavecore
