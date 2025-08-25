import { ENCODER, writeUint16, writeUint32 } from '@based/utils'
import { Ctx } from '../Ctx.js'
import native from '../../../native.js'

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

export function writeBinaryRaw(ctx: Ctx, val: Uint8Array) {
  const size = val.byteLength + 6
  const crc = native.crc32(val)
  writeUint32(ctx.array, size, ctx.index)
  writeUint16(ctx.array, 0, ctx.index + 4)
  ctx.array.set(val, ctx.index + 6)
  writeUint32(ctx.array, crc, ctx.index + 6 + val.byteLength)
  ctx.index = ctx.index + 6 + val.byteLength + 4
}
