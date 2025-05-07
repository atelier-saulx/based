import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { ENCODER } from '@saulx/utils'

const calculateHash32 = (name: string, uint8Array: Uint8Array, seed = 0) => {
  let hash = seed
  const prime1 = 31
  const prime2 = 17
  const prime3 = 41
  for (let i = 0; i < name.length; i++) {
    const charCode = name.charCodeAt(i)
    hash = (hash * prime3) ^ charCode
    hash = (hash * prime1) & 0xffffffff
  }
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

const simpleHashU8 = (name: string, uint8Array: Uint8Array) => {
  const seed1 = 0xabcdef01
  const seed2 = 0x10fedcba
  const hashPart1 = calculateHash32(name, uint8Array, seed1)
  const hashPart2 = calculateHash32(name, uint8Array, seed2)
  const highBitsContribution = Number(hashPart1) * 2097152
  const lowBitsContribution = hashPart2 >>> 11
  const result = highBitsContribution + lowBitsContribution
  return result
}

export const genObserveId = (name: string, payload: any): number => {
  if (payload === undefined) {
    // also for null :/ ?
    return hash(name)
  }
  if (payload instanceof Uint8Array) {
    return simpleHashU8(name, payload)
  } else if (typeof payload === 'string') {
    return simpleHashU8(name, ENCODER.encode(payload))
  } else {
    return hashObjectIgnoreKeyOrder([name, payload])
  }
}
