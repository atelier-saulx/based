import { ENCODER } from '@based/utils'

export function getBuffer(value: any): Uint8Array | undefined {
  if (typeof value === 'object') {
    if (value instanceof Uint8Array) {
      return value
    }
    if (value.buffer instanceof ArrayBuffer) {
      return new Uint8Array(value.buffer, 0, value.byteLength)
    }
  } else if (typeof value === 'string') {
    return ENCODER.encode(value)
  }
}
