import { Ctx } from '../Ctx.js'
import {
  BINARY,
  BOOLEAN,
  ENUM,
  INT16,
  INT32,
  INT8,
  NUMBER,
  PropDef,
  PropDefEdge,
  STRING,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
} from '@based/schema/def'
import { convertToTimestamp, ENCODER, writeDoubleLE } from '@based/utils'
import { getBuffer } from './binary.js'
import { reserve } from '../resize.js'
import { writeU16, writeU32, writeU64, writeU8, writeU8Array } from '../uint.js'
import { validate } from '../validate.js'

const map: Record<
  number,
  (ctx: Ctx, val: any, def: PropDef | PropDefEdge) => void
> = {}

map[BINARY] = (ctx, val, def) => {
  val = getBuffer(val)
  validate(val, def)
  reserve(ctx, val.byteLength + 1)
  writeU8(ctx, val.byteLength)
  writeU8Array(ctx, val)
}

map[STRING] = (ctx, val, def) => {
  const valBuf = ENCODER.encode(val)
  const size = valBuf.byteLength
  if (size + 1 > def.len) {
    throw [def, val, `max length of ${def.len - 1},`]
  }
  validate(val, def)
  reserve(ctx, size + 1)
  const fullSize = def.len - 1
  ctx.array[ctx.index] = size
  ctx.array.set(valBuf, ctx.index + 1)
  ctx.index += fullSize + 1
  if (fullSize !== size) {
    ctx.array.fill(0, ctx.index - (fullSize - size), ctx.index)
  }
}

map[BOOLEAN] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 1)
  writeU8(ctx, val ? 1 : 0)
}

map[ENUM] = (ctx, val, def) => {
  validate(val, def)
  if (val === null) {
    reserve(ctx, 1)
    writeU8(ctx, def.default)
  } else if (val in def.reverseEnum) {
    reserve(ctx, 1)
    writeU8(ctx, def.reverseEnum[val] + 1)
  } else {
    throw [def, val]
  }
}

map[NUMBER] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 8)
  writeDoubleLE(ctx.array, val, ctx.array.byteOffset + ctx.index)
  ctx.index += 8
}

map[TIMESTAMP] = (ctx, val, def) => {
  val ??= def.default
  const parsedValue = convertToTimestamp(val)
  validate(parsedValue, def)
  reserve(ctx, 8)
  writeU64(ctx, parsedValue)
}

map[UINT32] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 4)
  writeU32(ctx, val)
}

map[UINT16] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 2)
  writeU16(ctx, val)
}

map[UINT8] = map[INT8] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 1)
  writeU8(ctx, val)
}

map[INT32] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 4)
  writeU32(ctx, val)
}

map[INT16] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 2)
  writeU16(ctx, val)
}

export const writeFixed = (
  ctx: Ctx,
  def: PropDef | PropDefEdge,
  val: string | boolean | number,
) => {
  return map[def.typeIndex](ctx, val, def)
}

export const writeFixedAtOffset = (
  ctx: Ctx,
  def: PropDef,
  val: string | boolean | number,
  offset: number,
) => {
  const index = ctx.index
  ctx.index = offset
  map[def.typeIndex](ctx, val, def)
  ctx.index = index
}
