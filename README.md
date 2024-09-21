# `hyperwav`
A data structure for real-time reading, editing, seeking, and encoding of mono
WAV audio files via hypercore v10. Version control, branches, and peering come
for free thanks to the [`hypercore@next`][h] branch.
## Getting Started
### Installation
```sh
$ npm install git+ssh://git@github.com:sacreddata/hyperwav.git
```
### Status
> WIP, expect breaking changes
## Background
This library's intent is to enable real-time peer-to-peer recording, editing, and
remixing of audio content without sacrificing fidelity, privacy, nor speed.

The WAV audio can be sourced from any valid instance of
[`random-access-storage`][ras] and can be therefore stored in memory as a
buffer, on S3 as a remote cloud URI, or as a file on the local file system. This
means it is functional on local offline-first client applications, server-side
applications, and web apps all from one codebase.
### Functionality
> ***ANYTHING YOU CAN DO IN HYPERCORE, YOU CAN DO IN WAVECORE.***
> [Start here!][h]
#### Create Operations
> A Hyperwav can be created from a number of inputs and sources; with no
> arguments provided at all, a new Hyperwav with sane defaults is provided.
- [x] Create new Hyperwav with no inputs
- [x] Create new Hyperwav with [`Source`][lmbsrc] input
- [x] Create new Hyperwav with [hypercore][h] input
- [x] Create new Hyperwav from other Wavecore
- [x] Create new Hyperwav with [`random-access-storage`][ras] input
#### Write Operations
- [x] Append
- [x] Pad tail (Add blank data to tail to extend duration)
#### Editing Operations
> Hyperwav audio editing tasks mimic the methods offered by [JavaScript
> Arrays][mdnarray]
- [x] Trim: [shift][shift]
- [x] Trim: [truncate][trunc]
- [x] [Split][split]
- [x] [Join][concat]
#### Timeline Operations
- [x] [Playback][play]
- [x] [Seeking][seek]
- [x] [Zero-cross detection][zero]
- [x] [DC offset][dco]
#### DSP Operations
- [x] [Bit depth conversion][bdc]
- [x] [Gain][gain]
- [x] [Normalization][norm]
- [x] [Time Stretch][tempo]
- [x] [Sample Rate Conversion][src]
#### Helper Functions
- [x] [Sessions][session]
- [x] [Snapshots][snapshot]
#### Analysis Operations
- [x] SoX `stat`
- [x] SoX `stats`
- [ ] SoX `spectrogram`
- [ ] `audiowaveform` peaks data
- [ ] `aubioonset` onset timing
- [ ] `fpcalc` fingerprint
#### Tagging Operations
- [x] RIFF [tags][tag]
- [ ] BWF tags
- [ ] Cue points (in progress)
#### P2P
- [ ] Replication between Hyperwavs
### Design
#### Mono WAV Only
There were several factors influencing the decision to support only mono WAV
data. Most notably, the Web Audio API's `AudioBuffer.getChannelData()` method,
as its name suggests, loads audio data one channel at a time. Hyperwav audio
data can therefore be easily loaded inline with that method, querying it for
specific data ranges before having to allocate buffer resources.

By forcing all Hyperwavs to be mono-first, we also enable different processing to
occur on each channel of audio without worrying about data interleaving.
## Examples
### Recording Into A Hyperwav
#### [`MediaRecorder`][mr]
##### Stream-based
```js
const mr = new MediaRecorder(stream)
const wave = new Hyperwav()
wave.recStream(mr.stream)
```
##### Event-based
```js
const core = new Hypercore(ram)
mediaRecorder.onstop = function() {
  const wave = new Hyperwav({ core })
}
mediaRecorder.ondataavailable = function(d) {
  core.append(d.data)
}
```
### Playing A Hyperwav
#### Play Indexed Audio Data (SoX)
```js
const wavecore = new HyperwavSox({ source })
await wavecore.open()
wavecore.play({start: 5, end: 13}) // Play indeces 5 through 13
```
#### Listen For Live Audio Updates
> Listen to the audio being inserted in the Hyperwav **in real-time!**
> ***Yes, you read that correctly: REAL-TIME!***
```js
const wavecore = new Hyperwav({ source })
await wavecore.open()
const waveStream = wavecore._liveStream()
// Consume this ReadableStream to listen to the audio as it gets recorded into
// the Hyperwav!
```
### Editing Operations
#### Editing Sessions & Snapshots
Here we make a snapshot of our Hyperwav so we can test out an edit to the WAV
audio. By using our new session to test the edit we leave the original Hyperwav
audio in-tact, enabling non-destructive editing with no additional memory
allocation necessary!
```js
const Hyperwav = require('@storyboard-fm/wavecore')

const wave = new Hyperwav({ source })
await wave.open()

const snapshot = wave.snapshot()
await wave.truncate(10)

console.log(wave.core.length) // 10
console.log(snapshot.core.length) // 58
```
#### Trimming Audio
##### Trim From Beginning
The following trims a Hyperwav to start on the 20th index.
```js
const Hyperwav = require('@storyboard-fm/wavecore')
const wave = new Hyperwav({ source })

await wave.open()
console.log(wave.core.length) // 58
const shiftedCore = await Promise.resolve(wave.shift(20))
console.log(shiftedCore.length) // 38
```
##### Trim From End
The following truncates a Hyperwav to the first 20 indeces.
```js
const Hyperwav = require('@storyboard-fm/wavecore')
const wave = new Hyperwav({ source })

await wave.open()
console.log(wave.core.length) // 58
await wave.truncate(20)
console.log(wave.core.length) // 20
```
#### Splitting Audio

Execute this script at `example2.js`.

```js
const Hyperwav = require('.')

const w = new Hyperwav({ source })

async function main() {
  await w.open()
  console.log('splitting Hyperwav at index 22....')
  const [head, tail] = await w.split(22)
  console.log('done!', head, tail)
}

main()
```
### Signal Processing
#### Gain (+ Limiting) via SoX
> Increase gain by +6dBFS and add a limiter to prevent clipping
```js
const wave = new HyperwavSox({ source })
await wave.open()
const gainUp = await wave.gain('+6', {limiter:true})
```
#### Normalization
##### `AudioBuffer`
```js
const wave = new Hyperwav({ source })
await wave.open()
const audioBufferNorm = await wave.audioBuffer({ normalize: true })
```
##### SoX
> Increase gain so that the peak dBFS value = 0
```js
const wave = new HyperwavSox({ source })
await wave.open()
const normCore = await wave.norm()
```
#### Playback Rate (SoX)
> Change the "tempo" of the audio without changing the pitch
```js
const wave = new HyperwavSox({ source })
await wave.open()
const snap = wave.snapshot() // save copy of original audio
const slowerWave = await Promise.resolve(wave.tempo(0.8)) // 20% slower
const fasterWave = await Promise.resolve(wave.tempo(1.1)) // 10% faster
```

## Tags
> Certain operations in Hyperwav provide RIFF tags which, when converting from PCM
> to WAV file format, will be written to the resultant WAV file. They are
> detailed in the table below.

| Tag String | Description |
|------------|-------------|
| `PRT1`     | Part number |
| `PRT2`     | Total parts |
| `TCOD`     | Start time (ms) |
| `TCDO`     | End time (ms) |
| `STAT`     | "0" = Clipping; "1" = Normal |

## Tests

| Statements                  | Branches                | Functions                 | Lines             |
| --------------------------- | ----------------------- | ------------------------- | ----------------- |
| ![Statements](https://img.shields.io/badge/statements-80.39%25-yellow.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-76.87%25-red.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-80.23%25-yellow.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-85.85%25-yellow.svg?style=flat) |

We use `mocha`, with `nyc` for test coverage reporting.
```sh
$ npm run test
```

[bdc]: https://sacreddata.github.io/hyperwav/Hyperwav.html#audioBuffer
[concat]: https://sacreddata.github.io/hyperwav/Hyperwav.html#concat
[dco]: https://sacreddata.github.io/hyperwav/Hyperwav.html#audioBuffer
[gain]: https://sacreddata.github.io/hyperwav/HyperwavSox.html#gain
[h]: https://github.com/hypercore-protocol/hypercore-next
[lmbsrc]: https://storyboard-fm.github.io/little-media-box/Source.html
[mdnarray]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
[mr]: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
[norm]: https://sacreddata.github.io/hyperwav/HyperwavSox.html#norm
[play]:  https://sacreddata.github.io/hyperwav/HyperwavSox.html#play
[ras]: https://github.com/random-access-storage
[seek]: https://sacreddata.github.io/hyperwav/Hyperwav.html#seek
[session]: https://sacreddata.github.io/hyperwav/Hyperwav.html#session
[snapshot]: https://sacreddata.github.io/hyperwav/Hyperwav.html#snapshot
[shift]: https://sacreddata.github.io/hyperwav/Hyperwav.html#shift
[sox]: http://sox.sourceforge.net/
[split]: https://sacreddata.github.io/hyperwav/Hyperwav.html#split
[src]: https://sacreddata.github.io/hyperwav/Hyperwav.html#audioBuffer
[tag]: https://sacreddata.github.io/hyperwav/Hyperwav.html#tag
[tempo]: https://sacreddata.github.io/hyperwav/HyperwavSox.html#tempo
[trunc]: https://sacreddata.github.io/hyperwav/Hyperwav.html#truncate
[zero]: https://sacreddata.github.io/hyperwav/Hyperwav.html#_nextZero
