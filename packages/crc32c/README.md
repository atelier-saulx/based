# CRC32C Implementation

This package provides an implementation of the CRC32C checksum algorithm in TypeScript.

## Overview

CRC32C (Cyclic Redundancy Check) is an error-detecting code commonly used to detect accidental changes to raw data. This implementation uses a precomputed table to efficiently compute the CRC32C checksum for a given buffer.

This implementation targets browser utilization (no backend calculation).

## Installation

To install this package, you can use npm or yarn:

```sh
npm install @based-db/crc32c
```

or

```sh
yarn add @based-db/crc32c
```

## Usage

To use the CRC32C function, import it from the package and pass a buffer to it:

```typescript
import { crc32c } from '@based-db/crc32c'

const data = 'your data here'
const checksum = crc32c(data)

console.log(`CRC32C checksum: ${checksum}`)
```

Inside Based.db it just builds as a package inside it.
In based-db directory, run:

```sh
npm run build
```

## API

### `crc32c(value: string | UInt16Array): number`

Computes the CRC32C checksum for the given buffer.

- **Parameters:**

  - `value` ( The input value for which the CRC32C checksum is to be computed.

- **Returns:**
  - `number`: The computed CRC32C checksum.

## License

This project is UNLICENSED.
