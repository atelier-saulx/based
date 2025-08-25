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
import {
  convertToTimestamp,
  writeInt64,
  writeUint32,
  writeUint16,
  writeInt32,
  writeInt16,
  ENCODER,
} from '@based/utils'
import { getBuffer } from './binary.js'
import { reserve, resize } from '../resize.js'

const map: Record<
  number,
  (ctx: Ctx, val: any, def: PropDef | PropDefEdge) => void
> = {}

map[BINARY] = (ctx, val, def) => {
  const buf = getBuffer(val)
  if (buf === undefined || !def.validation(val, def)) {
    throw [def, val]
  }
  const size = buf.byteLength
  const end = ctx.index + size + 1
  resize(ctx, end)
  ctx.array[ctx.index] = size
  ctx.array.set(buf, ctx.index + 1)
  ctx.index = end
}

map[STRING] = (ctx, val, def) => {
  const valBuf = ENCODER.encode(val)
  const size = valBuf.byteLength
  if (size + 1 > def.len) {
    throw [def, val, `max length of ${def.len - 1},`]
  }
  if (!def.validation(val, def)) {
    throw [def, val]
  }
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
  if (val === null) {
    val = def.default
  }
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  if (typeof val !== 'boolean') {
    throw [def, val]
  }
  reserve(ctx, 1)
  ctx.array[ctx.index] = val ? 1 : 0
  ctx.index += 1
}

map[ENUM] = (ctx, val, def) => {
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  if (val === null) {
    reserve(ctx, 1)
    ctx.array[ctx.index] = def.default
  } else if (val in def.reverseEnum) {
    reserve(ctx, 1)
    ctx.array[ctx.index] = def.reverseEnum[val] + 1
  } else {
    throw [def, val]
  }

  ctx.index += 1
}

map[NUMBER] = (ctx, val, def) => {
  val ??= def.default
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  const view = new DataView(
    ctx.array.buffer,
    ctx.array.byteOffset + ctx.index,
    8,
  )
  reserve(ctx, 8)
  view.setFloat64(0, val, true)
  ctx.index += 8
}

map[TIMESTAMP] = (ctx, val, def) => {
  val ??= def.default
  const parsedValue = convertToTimestamp(val)
  if (!def.validation(parsedValue, def)) {
    throw [def, val]
  }
  reserve(ctx, 8)
  writeInt64(ctx.array, parsedValue, ctx.index)
  ctx.index += 8
}

map[UINT32] = (ctx, val, def) => {
  val ??= def.default
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  reserve(ctx, 4)
  writeUint32(ctx.array, val, ctx.index)
  ctx.index += 4
}

map[UINT16] = (ctx, val, def) => {
  val ??= def.default
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  reserve(ctx, 2)
  writeUint16(ctx.array, val, ctx.index)
  ctx.index += 2
}

map[UINT8] = map[INT8] = (ctx, val, def) => {
  val ??= def.default
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  reserve(ctx, 1)
  ctx.array[ctx.index] = val
  ctx.index += 1
}

map[INT32] = (ctx, val, def) => {
  val ??= def.default
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  reserve(ctx, 4)
  writeInt32(ctx.array, val, ctx.index)
  ctx.index += 4
}

map[INT16] = (ctx, val, def) => {
  val ??= def.default
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  reserve(ctx, 2)
  writeInt16(ctx.array, val, ctx.index)
  ctx.index += 2
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
