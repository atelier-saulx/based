# Installation

## npm

```bash
npm install @based/db
```

### Prerequisites:

- Node ≥ 22.14
- gcc 14.2 (Linux) or clang 17 (macOS)
- Zig 0.14.0

```bash
npm run get-napi   # fetches native N-API bindings
npm run build      # compiles the native addon
```

## Docker

We publish multi-arch images on GHCR:

```bash
docker run -p 9000:9000 \
  ghcr.io/atelier-saulx/based:latest
```

Mount a volume for persistence:

```bash
docker run -p 9000:9000 \
  -v $PWD/data:/data \
  ghcr.io/atelier-saulx/based:latest
```

## From source

```bash
git clone https://github.com/atelier-saulx/based
cd based/packages/db
npm run build
```
