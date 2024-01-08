# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `CMD_ID_PIPE`/`"pipe"` for piping commands together without a roundtrip back to the client

### Changed

- Change the subtree compression to use the zsdb format like it's used with dump files

### Fixed

- Fix hierarchy subtree compression
- Fix dump loading crash when an edge metadata is missing from a bidir field (f6af7428f12201fb9579e8888518fcd448b981fd)
