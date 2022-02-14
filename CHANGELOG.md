# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Storyboard-fm/wavecore/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/Storyboard-fm/wavecore/releases/tags/v0.0.5
