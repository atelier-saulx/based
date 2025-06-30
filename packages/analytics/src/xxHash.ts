// @ts-nocheck replace this with db native xxhash
export const xxHash64 = (
  inputData,
  outputDestArray,
  outputDestIndex,
  seed = 0n,
) => {
  // Prime numbers used in the xxHash64 algorithm (64-bit versions)
  const PRIME64_1 = 11400714785074694791n
  const PRIME64_2 = 14029467366897019727n
  const PRIME64_3 = 1609587929392839161n
  const PRIME64_4 = 9650029242287828579n
  const PRIME64_5 = 2870177450012600261n

  let inputAsU8Array
  // Ensure inputData is a Uint8Array
  if (typeof inputData === 'string') {
    inputAsU8Array = new TextEncoder().encode(inputData)
  } else if (inputData instanceof Uint8Array) {
    inputAsU8Array = inputData
  } else {
    throw new TypeError('Input data must be a string or Uint8Array.')
  }

  // Check if the output array has enough space
  if (!outputDestArray || outputDestArray.length < outputDestIndex + 8) {
    throw new Error(
      'Output destination array is too small or invalid for the 64-bit hash.',
    )
  }

  const buffer = inputAsU8Array
  const length = buffer.length
  let currentIndex = 0
  let h64 // This will hold the 64-bit hash as a BigInt

  // Step 1: Initialize accumulator
  if (length >= 32) {
    let v1 = seed + PRIME64_1 + PRIME64_2
    let v2 = seed + PRIME64_2
    let v3 = seed + 0n // Initialize with seed
    let v4 = seed - PRIME64_1

    // Step 2: Process input in 32-byte chunks
    do {
      const k1 = readLE64(buffer, currentIndex)
      const k2 = readLE64(buffer, currentIndex + 8)
      const k3 = readLE64(buffer, currentIndex + 16)
      const k4 = readLE64(buffer, currentIndex + 24)
      currentIndex += 32

      v1 = mixRound(v1, k1)
      v2 = mixRound(v2, k2)
      v3 = mixRound(v3, k3)
      v4 = mixRound(v4, k4)
    } while (currentIndex <= length - 32)

    // Step 3: Merge accumulators
    h64 = rotl64(v1, 1n) + rotl64(v2, 7n) + rotl64(v3, 12n) + rotl64(v4, 18n)

    h64 = mergeRound(h64, v1)
    h64 = mergeRound(h64, v2)
    h64 = mergeRound(h64, v3)
    h64 = mergeRound(h64, v4)
  } else {
    // Input length is less than 32 bytes
    h64 = seed + PRIME64_5
  }

  // Add input length to the hash
  h64 += BigInt(length)

  // Step 4: Process remaining data in 8-byte, 4-byte, and 1-byte chunks
  while (currentIndex <= length - 8) {
    const k1 = readLE64(buffer, currentIndex)
    h64 ^= mixRound(0n, k1) // Mix with 0n as accumulator for this step
    h64 = rotl64(h64, 27n) * PRIME64_1 + PRIME64_4
    currentIndex += 8
  }

  if (currentIndex <= length - 4) {
    const k1 = BigInt(readLE32(buffer, currentIndex)) // Read 32 bits, convert to BigInt
    h64 ^= k1 * PRIME64_1
    h64 = rotl64(h64, 23n) * PRIME64_2 + PRIME64_3
    currentIndex += 4
  }

  while (currentIndex < length) {
    const k1 = BigInt(buffer[currentIndex++]) // Read single byte, convert to BigInt
    h64 ^= k1 * PRIME64_5
    h64 = rotl64(h64, 11n) * PRIME64_1
  }

  // Step 5: Final avalanche mixing
  h64 ^= h64 >> 33n
  h64 *= PRIME64_2
  h64 ^= h64 >> 29n
  h64 *= PRIME64_3
  h64 ^= h64 >> 32n

  // Ensure h64 is a 64-bit unsigned BigInt before writing
  h64 &= 0xffffffffffffffffn

  // Step 6: Write the 64-bit hash (h64) into outputDestArray at outputDestIndex (Little Endian)
  for (let i = 0; i < 8; i++) {
    outputDestArray[outputDestIndex + i] = Number(
      (h64 >> BigInt(8 * i)) & 0xffn,
    )
  }
  // The function modifies outputDestArray in place and does not return a value.
}

// Helper function to read a 64-bit little-endian BigInt from a Uint8Array
const readLE64 = (buffer, offset) => {
  let val = 0n
  for (let i = 0; i < 8; i++) {
    val |= BigInt(buffer[offset + i]) << BigInt(8 * i)
  }
  return val
}

// Helper function to read a 32-bit little-endian number from a Uint8Array
const readLE32 = (buffer, offset) => {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  )
}

// Helper function for 64-bit left rotation
const rotl64 = (x, r) => {
  x &= 0xffffffffffffffffn // Mask to 64 bits
  r &= 63n // Mask rotation to 0-63 (BigInt version)
  if (r === 0n) return x
  return ((x << r) | (x >> (64n - r))) & 0xffffffffffffffffn
}

// Helper function for a round of mixing (used for 32-byte chunk processing)
const mixRound = (acc, input) => {
  const PRIME64_1 = 11400714785074694791n
  const PRIME64_2 = 14029467366897019727n
  const PRIME64_4 = 9650029242287828579n

  // Apply transformations as per xxHash algorithm for a round
  input *= PRIME64_2
  input = rotl64(input, 31n)
  input *= PRIME64_1

  acc += input
  acc = rotl64(acc, 27n)
  acc *= PRIME64_1
  acc += PRIME64_4
  return acc & 0xffffffffffffffffn // Ensure 64-bit result
}

// Helper function for merging accumulators (used after 32-byte chunk processing)
const mergeRound = (acc, val) => {
  const PRIME64_1 = 11400714785074694791n
  const PRIME64_2 = 14029467366897019727n
  const PRIME64_4 = 9650029242287828579n

  val = rotl64(val * PRIME64_2, 31n) * PRIME64_1 // Mix val
  acc ^= val
  acc = acc * PRIME64_1 + PRIME64_4
  return acc & 0xffffffffffffffffn // Ensure 64-bit result
}
