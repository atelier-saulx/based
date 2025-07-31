import { ENCODER } from '@based/utils'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'

const calculateHash32 = (uint8Array: Uint8Array, seed = 0) => {
  let hash = seed
  const prime1 = 31
  const prime2 = 17
  for (let i = 0; i < uint8Array.length; i++) {
    hash = (hash * prime1) ^ uint8Array[i]
    hash = (hash * prime2) & 0xffffffff
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return hash >>> 0
}

const simpleHashU8 = (uint8Array: Uint8Array) => {
  const seed1 = 0xabcdef01
  const seed2 = 0x10fedcba
  const hashPart1 = calculateHash32(uint8Array, seed1)
  const hashPart2 = calculateHash32(uint8Array, seed2)
  const highBitsContribution = Number(hashPart1) * 2097152
  const lowBitsContribution = hashPart2 >>> 11
  const result = highBitsContribution + lowBitsContribution
  return result
}

export const genChecksum = (data: any): number => {
  if (data instanceof Uint8Array) {
    return simpleHashU8(data)
  }

  if (typeof data === 'object' && data !== null) {
    return hashObjectIgnoreKeyOrder(data)
  }

  return hash(data)
}
