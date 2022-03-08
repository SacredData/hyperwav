# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.8] - 2022-03-08
### Changed
- stream recording to use same indeces as raw buffers

## [0.1.7] - 2022-03-08
### Changed
- open() method to read from the source at specified intervals; removes dependency on lmb

## [0.1.6] - 2022-03-04
### Added
- audiobuffer mixing
- classification method to determine whether audio is quiet or a voice recording

## [0.1.5] - 2022-03-03
### Added
- encryptionKey opt to wavecore constructor

## [0.1.4] - 2022-03-01
### Added
- normalize and dcOffset DSP options for audiobuffer method

### Fixed
- incorrect formatting opts made audiobuffer output wrong

## [0.1.3] - 2022-02-19
### Added
- seek optional argument to return next zero crossing byteOffset

## [0.1.2] - 2022-02-17
### Changed
- nextZero method to accept a seek return value

## [0.1.1] - 2022-02-17
### Added
- vad method for removing excessive silences

## [0.1.0] - 2022-02-16
### Changed
- volume adjustment and normalization methods to allow for a custom range of indeces to process, rather than the entire wavecore

### Added
- new methods for creating a wavecore from a new recording via the `rec` command line tool

## [0.0.9] - 2022-02-16
### Added
- Gain method to apply or attenuate gain in the audio

## [0.0.8] - 2022-02-15
### Fixed
- open method so it does not open cores twice

### Added
- a class method to record an audio stream into a Wavecore

## [0.0.7] - 2022-02-15
### Changed
- some functions to class getters, improving performance

## [0.0.6] - 2022-02-15
### Added
- custom playback range option for playback method

## [0.0.5] - 2022-02-14
### Added
- Wavecore class and associated little-media-box dependencies
- git hooks for linting before commit
- Seek the wave file via hypercore
- shift() method for trimming wavecores from the beginning
- github actions workflows for automated testing
- new jsdoc template
- addBlank() method for adding blank data to end of file
- audiobuffer and wav file support
- Tempo method for time stretching audio
- has method to check if a wavecore has a block at a given index
- stats option for tempo method
- storage option for wav method

### Changed
- the return of the snapshot method from a hypercore to a wavecore

[Unreleased]: https://github.com/Storyboard-fm/wavecore/compare/v0.1.8...HEAD
[0.1.8]: https://github.com/Storyboard-fm/wavecore/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/Storyboard-fm/wavecore/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/Storyboard-fm/wavecore/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/Storyboard-fm/wavecore/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/Storyboard-fm/wavecore/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/Storyboard-fm/wavecore/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Storyboard-fm/wavecore/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Storyboard-fm/wavecore/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Storyboard-fm/wavecore/compare/v0.0.9...v0.1.0
[0.0.9]: https://github.com/Storyboard-fm/wavecore/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/Storyboard-fm/wavecore/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/Storyboard-fm/wavecore/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/Storyboard-fm/wavecore/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/Storyboard-fm/wavecore/releases/tags/v0.0.5
