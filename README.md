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
### Functionality
#### Create Operations
- [x] Create new Wavecore with no inputs
- [x] Create new Wavecore with [`Source`][lmbsrc] input
- [x] Create new Wavecore with [hypercore][h] input
- [x] Create new Wavecore from other Wavecore
- [x] Create new Wavecore with [`random-access-storage`][ras] input
#### Editing Operations
- [x] Trim: [shift][shift]
- [x] Trim: [truncate][trunc]
- [x] [Split][split]
- [ ] Join
- [ ] Overwrite: single block
- [ ] Overwrite: range
- [ ] Overwrite: discrete range of blocks
#### P2P
- [ ] Replication between Wavecores
## Getting Started
### Installation
```sh
$ npm install command goes here
```
## Examples
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
console.log(wave.core.length) // 68
const shiftedCore = await Promise.resolve(wave.shift(20))
console.log(shiftedCore.length) // 48
```
#### Trim From End
The following truncates a Wavecore to the first 20 indeces.
```js
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('@storyboard-fm/wavecore')
const source = new Source('./test.wav')
const wave = new Wavecore({ source })

await Promise.resolve(wave.toHypercore())
console.log(wave.core.length) // 68
await wave.truncate(20)
console.log(wave.core.length) // 20
```
## Tests

| Statements                  | Branches                | Functions                 | Lines             |
| --------------------------- | ----------------------- | ------------------------- | ----------------- |
| ![Statements](https://img.shields.io/badge/statements-79.43%25-red.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-75.75%25-red.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-77.14%25-red.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-83.87%25-yellow.svg?style=flat) |

We use `mocha`, with `nyc` for test coverage reporting.
```sh
$ npm run test
```

[h]: https://github.com/hypercore-protocol/hypercore-next
[lmbsrc]: https://storyboard-fm.github.io/little-media-box/Source.html
[ras]: https://github.com/random-access-storage
[shift]: https://storyboard-fm.github.io/wavecore/Wavecore.html#shift
[split]: https://storyboard-fm.github.io/wavecore/Wavecore.html#split
[trunc]: https://storyboard-fm.github.io/wavecore/Wavecore.html#truncate
