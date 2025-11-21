import { writeU16, writeU32, writeU8, writeU8Array } from '../uint.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { validate } from '../validate.js'
import native from '../../../native.js'
import { reserve } from '../resize.js'
import { deleteProp } from './delete.js'
import { ENCODER } from '@based/utils'
import { Ctx } from '../Ctx.js'
import { typeMap, type LeafDef } from '@based/schema'

export const getBuffer = (val: any): Uint8Array | void => {
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

export const writeBinary = (
  ctx: Ctx,
  def: LeafDef,
  val: any,
  validated?: boolean,
) => {
  if (val === null) {
    deleteProp(ctx, def)
    return
  }

  const buf = getBuffer(val)
  if (buf === undefined) {
    throw [def, val]
  }
  if (!validated) {
    validate(buf, def)
  }
  if (!buf.byteLength) {
    deleteProp(ctx, def)
    return
  }
  const size = buf.byteLength + 6
  reserve(ctx, PROP_CURSOR_SIZE + size + 11)
  writePropCursor(ctx, def, typeMap.enum)
  writeU8(ctx, ctx.operation)
  writeBinaryRaw(ctx, buf)
}
