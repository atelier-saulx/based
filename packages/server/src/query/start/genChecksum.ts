import { BasedQueryResponse } from '@based/db'
import { hashObjectIgnoreKeyOrder, hash } from '@based/hash'
import { hashUint8Array } from '@based/hash'

const MAX_SAFE_INT = 9007199254740990

export const genChecksum = (data: any): number => {
  if (data instanceof BasedQueryResponse) {
    return data.version
  }

  if (typeof data === 'number') {
    if (data === 0) {
      data = MAX_SAFE_INT
    }
    return data
  }

  if (data instanceof Uint8Array) {
    return hashUint8Array(data)
  }

  if (typeof data === 'object' && data !== null) {
    return hashObjectIgnoreKeyOrder(data)
  }

  return hash(data)
}
