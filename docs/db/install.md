# Installation

## npm

```bash
npm install @based/db
```

## Podman

This script builds a container image for building `based-db` server for different
architectures on macOS.

**Prerequisites**

- Node ≥ 22.14
- [podman desktop](https://podman-desktop.io/)

**Building**

```bash
npm run build-podman
```

or

```bash
cd podman
./build.sh
```

## Locally

**Prerequisites**

- Node ≥ 22.14
- GNU make
- gcc 14.2 (Linux) or clang 17 (macOS)
- Zig 0.14.0

**Building**

```bash
git clone https://github.com/atelier-saulx/based
cd based/packages/db
npm run build
```
