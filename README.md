# @storyboard-fm/wavecore
A data structure for real-time reading, editing, seeking, and encoding of mono
WAV audio files via hypercore v10. Version control, branches, and peering come
for free thanks to the `hypercore@next` branch.
## Background
This library's intent is to enable real-time peer-to-peer recording, editing, and
remixing of audio content without sacrificing fidelity, privacy, nor speed.

The WAV audio can be sourced from any valid instance of
[`random-access-storage`][ras] and can be therefore stored in memory as a
buffer, on S3 as a remote cloud URI, or as a file on the local file system. This
means it is functional on local offline-first client applications, server-side
applications, and web apps all from one codebase.
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
| ![Statements](https://img.shields.io/badge/statements-55.76%25-red.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-68.96%25-red.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-50%25-red.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-60%25-red.svg?style=flat) |

We use `mocha`, with `nyc` for test coverage reporting.
```sh
$ npm run test
```

[ras]: https://github.com/random-access-storage
