# @storyboard-fm/wavecore
A data structure for real-time reading, editing, seeking, and encoding of mono
WAV audio files via hypercore v10. Version control, branches, and peering come
for free thanks to the [`hypercore@next`][h] branch.
## Background
This library's intent is to enable real-time peer-to-peer recording, editing, and
remixing of audio content without sacrificing fidelity, privacy, nor speed.

The WAV audio can be sourced from any valid instance of
[`random-access-storage`][ras] and can be therefore stored in memory as a
buffer, on S3 as a remote cloud URI, or as a file on the local file system. This
means it is functional on local offline-first client applications, server-side
applications, and web apps all from one codebase.
### Design
#### Mono WAV Only
There were several factors influencing the decision to support only mono WAV
data. Most notably, the Web Audio API's `AudioBuffer.getChannelData()` method,
as its name suggests, loads audio data one channel at a time. Wavecore audio
data can therefore be easily loaded inline with that method, querying it for
specific data ranges before having to allocate buffer resources.

By forcing all Wavecores to be mono-first, we also enable different processing to
occur on each channel of audio without worrying about data interleaving.
### Functionality
#### Create Operations
- [x] Create new Wavecore with no inputs
- [x] Create new Wavecore with [`Source`][lmbsrc] input
- [x] Create new Wavecore with [hypercore][h] input
- [x] Create new Wavecore from other Wavecore
- [x] Create new Wavecore with [`random-access-storage`][ras] input
#### Write Operations
- [ ] Pad head (Add blank data to head to extend duration)
- [x] Pad tail (Add blank data to tail to extend duration)
#### Editing Operations
- [x] Trim: [shift][shift]
- [x] Trim: [truncate][trunc]
- [x] [Split][split]
- [x] [Join][concat]
- [ ] Replace
#### Timeline Operations
- [x] Playback
- [x] Seeking
#### Tagging Operations
- [ ] RIFF tags (in progress)
- [ ] BWF tags
- [ ] Cue points
#### P2P
- [ ] Replication between Wavecores
## Getting Started
### Installation
```sh
$ npm install command goes here
```
## Examples
### Recording Into A Wavecore
```js
const core = new Hypercore(ram)
mediaRecorder.onstop = function() {
  const wave = new Wavecore({ core })
}
mediaRecorder.ondataavailable = function(d) {
  core.append(d.data)
}
```
### Splitting Audio

Execute this script at `example2.js`.

```js
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('.')

const source = new Source('./test/test.wav')
const w = new Wavecore({ source })

async function main() {
  await Promise.resolve(w.toHypercore())
  console.log('splitting Wavecore at index 22....')
  const [head, tail] = await w.split(22)
  console.log('done!', head, tail)
}

main()
```
### Trimming Audio
#### Trim From Beginning
The following trims a Wavecore to start on the 20th index.
```js
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('@storyboard-fm/wavecore')
const source = new Source('./test.wav')
const wave = new Wavecore({ source })

await Promise.resolve(wave.toHypercore())
console.log(wave.core.length) // 58
const shiftedCore = await Promise.resolve(wave.shift(20))
console.log(shiftedCore.length) // 38
```
#### Trim From End
The following truncates a Wavecore to the first 20 indeces.
```js
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('@storyboard-fm/wavecore')
const source = new Source('./test.wav')
const wave = new Wavecore({ source })

await Promise.resolve(wave.toHypercore())
console.log(wave.core.length) // 58
await wave.truncate(20)
console.log(wave.core.length) // 20
```
### Editing Sessions & Snapshots
Here we make a snapshot of our Wavecore so we can test out an edit to the WAV
audio. By using our new session to test the edit we leave the original Wavecore
audio in-tact, enabling non-destructive editing with no additional memory
allocation necessary!
```js
const Wavecore = require('@storyboard-fm/wavecore')
const source = new Source('./test/test.wav.raw')

const wave = new Wavecore({ source })
await Promise.resolve(wave.toHypercore())

wave.snapshot()
wave.session()

const tryEdit = Wavecore.fromCore(wave.sessions()[1], wave)
await Promise.resolve(tryEdit.toHypercore())
await tryEdit.truncate(10)

console.log(tryEdit.core.length) // 10
console.log(wave.core.length) // 58
```
## Tests

| Statements                  | Branches                | Functions                 | Lines             |
| --------------------------- | ----------------------- | ------------------------- | ----------------- |
| ![Statements](https://img.shields.io/badge/statements-62.65%25-red.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-51.78%25-red.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-65.95%25-red.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-67.13%25-red.svg?style=flat) |

We use `mocha`, with `nyc` for test coverage reporting.
```sh
$ npm run test
```

[concat]: https://storyboard-fm.github.io/wavecore/Wavecore.html#concat
[h]: https://github.com/hypercore-protocol/hypercore-next
[lmbsrc]: https://storyboard-fm.github.io/little-media-box/Source.html
[ras]: https://github.com/random-access-storage
[shift]: https://storyboard-fm.github.io/wavecore/Wavecore.html#shift
[split]: https://storyboard-fm.github.io/wavecore/Wavecore.html#split
[trunc]: https://storyboard-fm.github.io/wavecore/Wavecore.html#truncate
