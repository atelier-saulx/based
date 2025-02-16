# CRC32C Implementation

This package provides an implementation of the CRC32C checksum algorithm in TypeScript.

## Overview

CRC32C (Cyclic Redundancy Check) is an error-detecting code commonly used to detect accidental changes to raw data. This implementation uses a precomputed table to efficiently compute the CRC32C checksum for a given buffer.

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

const buffer = Buffer.from('your data here')
const checksum = crc32c(buffer)

console.log(`CRC32C checksum: ${checksum.toString(16)}`)
```

## API

### `crc32c(buffer: Buffer): number`

Computes the CRC32C checksum for the given buffer.

- **Parameters:**

  - `buffer` (Buffer): The input buffer for which the CRC32C checksum is to be computed.

- **Returns:**
  - `number`: The computed CRC32C checksum.

## Example

Here is an example of how to use the CRC32C function:

```typescript
import { crc32c } from '@based-db/crc32c'

const data = 'Hello, World!'
const buffer = Buffer.from(data)
const checksum = crc32c(buffer)

console.log(`CRC32C checksum for "${data}": ${checksum.toString(16)}`)
```

## License

This project is UNLICENSED.
