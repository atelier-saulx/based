import { writeU16, writeU32, writeU8, writeU8Array } from '../uint.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { validate } from '../validate.js'
import { PropDef } from '@based/schema/def'
import native from '../../../native.js'
import { reserve } from '../resize.js'
import { markDefaults } from '../create/mark.js'
import { deleteProp } from './delete.js'
import { ENCODER } from '@based/utils'
import { Ctx } from '../Ctx.js'

export const getBuffer = (val: any): Uint8Array => {
  if (typeof val === 'string') {
    return ENCODER.encode(val)
  }
  if (typeof val !== 'object') {
    return
  }
  if (val instanceof Uint8Array) {
    return val
  }
  if (val.buffer instanceof ArrayBuffer) {
    return new Uint8Array(val.buffer, 0, val.byteLength)
  }
}

export const writeBinaryRaw = (ctx: Ctx, val: Uint8Array): void => {
  const size = val.byteLength + 6
  const crc = native.crc32(val)
  writeU32(ctx, size)
  writeU16(ctx, 0)
  writeU8Array(ctx, val)
  writeU32(ctx, crc)
}

export const writeBinary = (ctx: Ctx, def: PropDef, val: any) => {
  if (val === null) {
    deleteProp(ctx, def)
    return
  }
  validate(def, val)
  const buf = getBuffer(val)
  if (!buf.byteLength) {
    deleteProp(ctx, def)
    return
  }
  const size = buf.byteLength + 6
  reserve(ctx, PROP_CURSOR_SIZE + 5 + size)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  writeU32(ctx, size)
  writeBinaryRaw(ctx, buf)
  markDefaults(ctx, def)
}
