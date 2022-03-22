const Hypercore = require('hypercore')
const nanoprocess = require('nanoprocess')
const { PassThrough } = require('stream')
const process = require('process')
const ram = require('random-access-memory')
const Wavecore = require('./index')
const WaveFile = require('wavefile').WaveFile

/**
 * The `WavecoreSox` class provides a SoX interface for Wavecore.
 * @class
 * @extends {Wavecore}
 */
class WavecoreSox extends Wavecore {
  /**
   * The `WavecoreSox` class constructor.
   * @arg {Object} [opts={}] - Options
   * @arg {Hypercore} [opts.core=null] - Provide a previously-made hypercore.
   * @arg {Integer} [opts.indexSize=null] - Declare an alternate index size.
   * @arg {Buffer|Readable|PassThrough|Array|ArrayBuffer} [opts.source] - PCM
   * source.
   * @arg {Buffer} [opts.encryptionKey=null] - Encryption key
   * @arg {random-access-storage} [opts.storage=ram] - Provide storage instance.
   * @returns {WavecoreSox} wavecoreSox - The new Wavecore with SoX methods.
   */
  constructor(opts={
    core: null,
    key: null,
    encryptionKey: null,
    hypercoreOpts: null,
    indexSize: 96000,
    parent: null,
    source: null,
    storage: null
  }) {
    super(opts)
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

        const newGainCore = new WavecoreSox(ram)
        const ws = newGainCore.createWriteStream({
          highWaterMark: this.indexSize,
        })
        ws.on('close', () => {
          newGainCore
            .update()
            .then(() => resolve(newGainCore))
        })
        gainCmd.stdout.pipe(ws)
        rs.pipe(gainCmd.stdin)
      })
    })

    return await Promise.resolve(prom)
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
          const newCore = new WavecoreSox(ram)

          const pt = new PassThrough({ highWaterMark: this.indexSize })
          pt.on('error', (err) => reject(err))
          pt.on('data', (d) => newCore.append(d))

          normCmd.on('close', (code) => {
            if (code !== 0) reject(new Error('Non-zero exit code'))
            resolve(newCore)
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

          this.update().then(() => resolve())
        })

        recCmd.stdout.pipe(
          this.createWriteStream({ highWaterMark: this.indexSize })
        )
      })
    })

    await Promise.resolve(prom)
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
          rs = this.createReadStream()
        }

        rs.pipe(statsCmd.stdin)
      })
    })
    return await Promise.resolve(prom)
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

        const newCore = new WavecoreSox(ram)

        const pt = new PassThrough()
        pt.on('data', (d) => newCore.append(d))

        tempoCmd.on('close', (code) => {
          if (code !== 0) reject(new Error('Non-zero exit code'))
          resolve(newCore)
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
    const newCore = new WavecoreSox(ram)
    const normCore = await this.norm()
    const prom = new Promise((resolve, reject) => {
      cmd.open((err) => {
        if (err) reject(err)

        cmd.on('close', (code) => {
          if (code !== 0) reject(new Error('Non-zero exit!', code))
          resolve(newCore)
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
        const rs = this.createReadStream()
        rs.pipe(soxCmd.stdin)
      })
    })
    return await Promise.resolve(np)
  }
}

module.exports = WavecoreSox
