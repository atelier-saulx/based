# Installation

## npm

```bash
npm install @based/db
```

## podman

This script builds a container image for building `based-db` server for different
architectures on macOS.

### Prerequisites:

- Node ≥ 22.14
- [podman desktop](https://podman-desktop.io/)

```bash
npm run build-podman
```

or

```bash
cd podman
./build.sh
```

## From source

### Prerequisites:

- Node ≥ 22.14
- gcc 14.2 (Linux) or clang 17 (macOS)
- Zig 0.14.0

```bash
git clone https://github.com/atelier-saulx/based
cd based/packages/db
npm run build
```
