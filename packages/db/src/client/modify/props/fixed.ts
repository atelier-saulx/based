import { Ctx } from '../Ctx.js'
import { convertToTimestamp, ENCODER, writeDoubleLE } from '@based/utils'
import { getBuffer } from './binary.js'
import { reserve } from '../resize.js'
import { writeU16, writeU32, writeU64, writeU8, writeU8Array } from '../uint.js'
import { validate } from '../validate.js'
import {
  type mainSizeMap,
  type MainDef,
  type SchemaBoolean,
  type SchemaEnum,
  type SchemaNumber,
  type SchemaTimestamp,
  typeIndexMap,
} from '@based/schema'

type WriteFixed = (ctx: Ctx, val: any, def: MainDef) => void
const getWriteInt =
  (size: number, writeU: typeof writeU8) =>
  (ctx: Ctx, val: any, def: SchemaNumber & MainDef) => {
    val ??= def.default
    validate(val, def)
    reserve(ctx, size)
    writeU(ctx, val)
  }

const write8 = getWriteInt(1, writeU8)
const write16 = getWriteInt(2, writeU16)
const write32 = getWriteInt(4, writeU32)

type Fixed = (typeof typeIndexMap)[keyof typeof mainSizeMap]
const map: Record<Fixed, WriteFixed> = {
  [typeIndexMap.binary](ctx, val, def) {
    val = getBuffer(val)
    validate(val, def)
    reserve(ctx, val.byteLength + 1)
    writeU8(ctx, val.byteLength)
    writeU8Array(ctx, val)
  },

  [typeIndexMap.string](ctx, val, def) {
    const valBuf = ENCODER.encode(val)
    const size = valBuf.byteLength
    if (size + 1 > def.main.size) {
      throw [def, val, `max length of ${def.main.size - 1},`]
    }
    validate(val, def)
    reserve(ctx, size + 1)
    const fullSize = def.main.size - 1
    ctx.array[ctx.index] = size
    ctx.array.set(valBuf, ctx.index + 1)
    ctx.index += fullSize + 1
    if (fullSize !== size) {
      ctx.array.fill(0, ctx.index - (fullSize - size), ctx.index)
    }
  },

  [typeIndexMap.boolean](ctx, val, def: SchemaBoolean & MainDef) {
    val ??= def.default
    validate(val, def)
    reserve(ctx, 1)
    writeU8(ctx, val ? 1 : 0)
  },

  [typeIndexMap.enum](ctx, val, def: SchemaEnum & MainDef) {
    validate(val, def)
    if (val === null) {
      reserve(ctx, 1)
      writeU8(ctx, def.default ? def.enumMap[def.default as string] : 0)
    } else if (val in def.enumMap) {
      reserve(ctx, 1)
      writeU8(ctx, def.enumMap[val])
    } else {
      throw [def, val]
    }
  },

  [typeIndexMap.number](ctx, val, def: SchemaNumber & MainDef) {
    val ??= def.default
    console.log('??', val)
    validate(val, def)
    console.log('??xxx')
    reserve(ctx, 8)
    writeDoubleLE(ctx.array, val, ctx.array.byteOffset + ctx.index)
    ctx.index += 8
  },

  [typeIndexMap.timestamp](ctx, val, def: SchemaTimestamp & MainDef) {
    val ??= def.default
    const parsedValue = convertToTimestamp(val)
    validate(parsedValue, def)
    reserve(ctx, 8)
    writeU64(ctx, parsedValue)
  },
  [typeIndexMap.uint32]: write32,
  [typeIndexMap.uint16]: write16,
  [typeIndexMap.uint8]: write8,
  [typeIndexMap.int32]: write32,
  [typeIndexMap.int16]: write16,
  [typeIndexMap.int8]: write8,
}

export const writeFixed = (
  ctx: Ctx,
  def: MainDef,
  val: string | boolean | number,
) => map[def.typeIndex](ctx, val, def)

export const writeFixedAtOffset = (
  ctx: Ctx,
  def: MainDef,
  val: string | boolean | number,
  offset: number,
) => {
  const index = ctx.index
  ctx.index = offset
  map[def.typeIndex](ctx, val, def)
  ctx.index = index
}
