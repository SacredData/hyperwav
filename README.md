# @storyboard-fm/wavecore
Converts a mono PCM WAV file into a Hypercore (v10).
## Background
> TBD
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
