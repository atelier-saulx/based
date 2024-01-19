# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Unicode 14.0.0 support

### Changed

- Moved `selva_lang` functionality to `libutil` and slightly changed the output of `lslang`
- Lazy load locales as needed for faster startup and memory savings

### Removed

### Fixed

## [2.0.1] - 2024-01-17

## [2.0.0] - 2024-01-17

### Added

- `CMD_ID_PIPE`/`"pipe"` for piping commands together without a roundtrip back to the client

### Changed

- Change the subtree compression to use the zsdb format like it's used with dump files
- Moved `sdb` and replication handling to the `io` module
- Max number of fds/clients increased from 100 to 10000
- Max number of streams per client increased from 2 to 3

### Removed

- Removed the `replication` module as its functionality is now implemented in the `io` module

### Fixed

- Fix hierarchy subtree compression
- Fix dump loading crash when an edge metadata is missing from a bidir field (f6af7428f12201fb9579e8888518fcd448b981fd)
