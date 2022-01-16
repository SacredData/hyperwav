# @storyboard-fm/wavecore
A data structure for real-time reading, editing, seeking, and encoding of mono
WAV audio files via hypercore v10. Version control, branches, and peering come
for free thanks to the `hypercore@next` branch.
## Background
This library's intent is to enable real-time peer-to-peer recording, editing, and
remixing of audio content without sacrificing fidelity, privacy, nor speed.
## Getting Started
> TBD
### Installation
```sh
$ npm install command goes here
```
## Example
```js
const { Source } = require('@storyboard-fm/little-media-box')
const Wavecore = require('.')

const s = new Source('./test.wav')
s.open(() => {
  async function main() {
    const w = new Wavecore(s)

    await w._toHypercore()
    console.log(w.core)
  }
  main()
})
```
## Goals
- [ ] index `0` contains RIFF headers
- [ ] index *1...n* are mono audio frames in linear order
### Future
- [ ] Configure append style (per-frame, per-vocal onset, per-silence,
  per-user speaking, etc.)
