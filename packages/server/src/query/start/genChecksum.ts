import { hashObjectIgnoreKeyOrder, hash } from '@based/hash'
import { hashUint8Array } from '@based/hash'

export const genChecksum = (data: any): number => {
  if (data instanceof Uint8Array) {
    return hashUint8Array(data)
  }

  if (typeof data === 'object' && data !== null) {
    return hashObjectIgnoreKeyOrder(data)
  }

  return hash(data)
}
