import { Ctx } from '../Ctx.js'
import { getBuffer } from './binary.js'
import { reserve } from '../resize.js'
import { writeU16, writeU32, writeU64, writeU8, writeU8Array } from '../uint.js'
import { validate } from '../validate.js'
import { PropType } from '../../../zigTsExports.js'
import type { PropDef, PropDefEdge } from '../../../schema/index.js'
import { ENCODER, writeDoubleLE } from '../../../utils/uint8.js'
import { convertToTimestamp } from '../../../utils/timestamp.js'

const map: Record<
  number,
  (ctx: Ctx, val: any, def: PropDef | PropDefEdge) => void
> = {}

map[PropType.binary] = (ctx, val, def) => {
  val = getBuffer(val)
  validate(val, def)
  reserve(ctx, val.byteLength + 1)
  writeU8(ctx, val.byteLength)
  writeU8Array(ctx, val)
}

map[PropType.string] = (ctx, val, def) => {
  const valBuf = ENCODER.encode(val)
  const size = valBuf.byteLength
  if (size + 1 > def.len) {
    throw [def, val, `max length of ${def.len - 1},`]
  }
  validate(val, def)
  reserve(ctx, size + 1)
  const fullSize = def.len - 1
  ctx.buf[ctx.index] = size
  ctx.buf.set(valBuf, ctx.index + 1)
  ctx.index += fullSize + 1
  if (fullSize !== size) {
    ctx.buf.fill(0, ctx.index - (fullSize - size), ctx.index)
  }
}

map[PropType.boolean] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 1)
  writeU8(ctx, val ? 1 : 0)
}

map[PropType.enum] = (ctx, val, def) => {
  validate(val, def)
  if (val === null) {
    reserve(ctx, 1)
    writeU8(ctx, def.default)
  } else if (val in def.reverseEnum!) {
    reserve(ctx, 1)
    writeU8(ctx, def.reverseEnum![val] + 1)
  } else {
    throw [def, val]
  }
}

map[PropType.number] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 8)
  writeDoubleLE(ctx.buf, val, ctx.buf.byteOffset + ctx.index)
  ctx.index += 8
}

map[PropType.timestamp] = (ctx, val, def) => {
  val ??= def.default
  const parsedValue = convertToTimestamp(val)
  validate(parsedValue, def)
  reserve(ctx, 8)
  writeU64(ctx, parsedValue)
}

map[PropType.uint32] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 4)
  writeU32(ctx, val)
}

map[PropType.uint16] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 2)
  writeU16(ctx, val)
}

map[PropType.uint8] = map[PropType.int8] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 1)
  writeU8(ctx, val)
}

map[PropType.int32] = (ctx, val, def) => {
  val ??= def.default
  validate(val, def)
  reserve(ctx, 4)
  writeU32(ctx, val)
}

map[PropType.int16] = (ctx, val, def) => {
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
