# @storyboard-fm/wavecore
A data structure for real-time reading, editing, seeking, and encoding of mono
WAV audio files via hypercore v10. Version control, branches, and peering come
for free thanks to the [`hypercore@next`][h] branch.
## Getting Started
### Installation
```sh
$ npm install git+ssh://git@github.com:storyboard-fm/wavecore.git
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
#### Create Operations
> A Wavecore can be created from a number of inputs and sources; with no
> arguments provided at all, a new Wavecore with sane defaults is provided.
- [x] Create new Wavecore with no inputs
- [x] Create new Wavecore with [`Source`][lmbsrc] input
- [x] Create new Wavecore with [hypercore][h] input
- [x] Create new Wavecore from other Wavecore
- [x] Create new Wavecore with [`random-access-storage`][ras] input
#### Write Operations
- [x] Append
- [x] Pad tail (Add blank data to tail to extend duration)
#### Editing Operations
> Wavecore audio editing tasks mimic the methods offered by [JavaScript
> Arrays][mdnarray]
- [x] Trim: [shift][shift]
- [x] Trim: [truncate][trunc]
- [x] [Split][split]
- [x] [Join][concat]
#### Timeline Operations
- [x] [Playback][play]
- [x] [Seeking][seek]
#### DSP Operations
- [x] [Gain][gain]
- [x] [Normalization][norm]
- [x] [Time Stretch][tempo]
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
- [ ] Replication between Wavecores
### Design
#### Mono WAV Only
There were several factors influencing the decision to support only mono WAV
data. Most notably, the Web Audio API's `AudioBuffer.getChannelData()` method,
as its name suggests, loads audio data one channel at a time. Wavecore audio
data can therefore be easily loaded inline with that method, querying it for
specific data ranges before having to allocate buffer resources.

By forcing all Wavecores to be mono-first, we also enable different processing to
occur on each channel of audio without worrying about data interleaving.
## Examples
### Recording Into A Wavecore
#### [`MediaRecorder`][mr]
##### Stream-based
```js
const mr = new MediaRecorder(stream)
const wave = new Wavecore()
wave.recStream(mr.stream)
// Optionally, monitor the Wavecore's input as it streams in:
// wave.monitor()
```
##### Event-based
```js
const core = new Hypercore(ram)
mediaRecorder.onstop = function() {
  const wave = new Wavecore({ core })
}
mediaRecorder.ondataavailable = function(d) {
  core.append(d.data)
}
```
#### CLI
```js
// Will record your microphone for 30 minutes
const recording = Wavecore.fromRec("30:00")
// Write the audio to your local disk and listen in real-time!
recording.liveStream.pipe(fs.createWriteStream('liverecording.wav'))
```
### Playing A Wavecore
#### Play Indexed Audio Data
```js
const wavecore = new Wavecore({ source })
await wavecore.open()
wavecore.play({start: 5, end: 13}) // Play indeces 5 through 13
```
#### Listen For Live Audio Updates
> Listen to the audio being inserted in the Wavecore **in real-time!**
> ***Yes, you read that correctly: REAL-TIME!***
```js
const wavecore = new Wavecore({ source })
await wavecore.open()
const waveStream = wavecore._liveStream()
// Consume this ReadableStream to listen to the audio as it gets recorded into
// the Wavecore!
```
### Editing Operations
#### Editing Sessions & Snapshots
Here we make a snapshot of our Wavecore so we can test out an edit to the WAV
audio. By using our new session to test the edit we leave the original Wavecore
audio in-tact, enabling non-destructive editing with no additional memory
allocation necessary!
```js
const Wavecore = require('@storyboard-fm/wavecore')
const source = new Source('./test/test.wav.raw')

const wave = new Wavecore({ source })
await wave.open()

const snapshot = wave.snapshot()
await wave.truncate(10)

console.log(wave.core.length) // 10
console.log(snapshot.core.length) // 58
```
#### Trimming Audio
##### Trim From Beginning
The following trims a Wavecore to start on the 20th index.
```js
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('@storyboard-fm/wavecore')
const source = new Source('./test.wav')
const wave = new Wavecore({ source })

await wave.open()
console.log(wave.core.length) // 58
const shiftedCore = await Promise.resolve(wave.shift(20))
console.log(shiftedCore.length) // 38
```
##### Trim From End
The following truncates a Wavecore to the first 20 indeces.
```js
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('@storyboard-fm/wavecore')
const source = new Source('./test.wav')
const wave = new Wavecore({ source })

await wave.open()
console.log(wave.core.length) // 58
await wave.truncate(20)
console.log(wave.core.length) // 20
```
#### Splitting Audio

Execute this script at `example2.js`.

```js
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('.')

const source = new Source('./test/test.wav')
const w = new Wavecore({ source })

async function main() {
  await w.open()
  console.log('splitting Wavecore at index 22....')
  const [head, tail] = await w.split(22)
  console.log('done!', head, tail)
}

main()
```
### Signal Processing
#### Gain (+ Limiting)
> Increase gain by +6dBFS and add a limiter to prevent clipping
```js
const wave = new Wavecore({ source })
await wave.open()
const gainUp = await wave.gain('+6', {limiter:true})
```
#### Normalization
> Increase gain so that the peak dBFS value = 0
```js
const wave = new Wavecore({ source })
await wave.open()
await wave.norm()
```
#### Playback Rate
> Change the "tempo" of the audio without changing the pitch
```js
const wave = new Wavecore({ source })
await wave.open()
const snap = wave.snapshot() // save copy of original audio
const slowerWave = await Promise.resolve(wave.tempo(0.8)) // 20% slower
const fasterWave = await Promise.resolve(wave.tempo(1.1)) // 10% faster
```
## Tests

| Statements                  | Branches                | Functions                 | Lines             |
| --------------------------- | ----------------------- | ------------------------- | ----------------- |
| ![Statements](https://img.shields.io/badge/statements-79.94%25-red.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-68%25-red.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-82.65%25-yellow.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-85.71%25-yellow.svg?style=flat) |

We use `mocha`, with `nyc` for test coverage reporting.
```sh
$ npm run test
```

[concat]: https://storyboard-fm.github.io/wavecore/Wavecore.html#concat
[gain]: https://storyboard-fm.github.io/wavecore/Wavecore.html#gain
[h]: https://github.com/hypercore-protocol/hypercore-next
[lmbsrc]: https://storyboard-fm.github.io/little-media-box/Source.html
[mdnarray]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
[mr]: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
[norm]: https://storyboard-fm.github.io/wavecore/Wavecore.html#norm
[play]:  https://storyboard-fm.github.io/wavecore/Wavecore.html#play
[ras]: https://github.com/random-access-storage
[seek]: https://storyboard-fm.github.io/wavecore/Wavecore.html#seek
[session]: https://storyboard-fm.github.io/wavecore/Wavecore.html#session
[snapshot]: https://storyboard-fm.github.io/wavecore/Wavecore.html#snapshot
[shift]: https://storyboard-fm.github.io/wavecore/Wavecore.html#shift
[sox]: http://sox.sourceforge.net/
[split]: https://storyboard-fm.github.io/wavecore/Wavecore.html#split
[tag]: https://storyboard-fm.github.io/wavecore/Wavecore.html#tag
[tempo]: https://storyboard-fm.github.io/wavecore/Wavecore.html#tempo
[trunc]: https://storyboard-fm.github.io/wavecore/Wavecore.html#truncate
