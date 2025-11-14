import { ALIAS, PropDef, PropDefEdge, TEXT, VECTOR } from '@based/schema/def'
import {
  EQUAL,
  EQUAL_CRC32,
  FILTER_MODE,
  INCLUDES,
  INCLUDES_TO_LOWER_CASE,
  LIKE,
  MODE_DEFAULT_VAR,
  MODE_OR_VAR,
  FilterCtx,
  getVectorFn,
} from './types.js'
import { createFixedFilterBuffer } from './createFixedFilterBuffer.ts'
import { crc32 } from '../../crc32.ts'
import { ENCODER, concatUint8Arr, writeUint16, writeUint32 } from '@based/utils'
import { FilterCondition, QueryDef } from '../types.ts'

const DEFAULT_SCORE = new Uint8Array(new Float32Array([0.5]).buffer)

const parseValue = (
  value: any,
  prop: PropDef | PropDefEdge,
  ctx: FilterCtx,
  lang: QueryDef['lang'],
): Uint8Array => {
  if (ctx.operation === INCLUDES_TO_LOWER_CASE && typeof value === 'string') {
    value = value.toLowerCase()
  }

  if (ctx.operation === LIKE && prop.typeIndex === VECTOR) {
    if (!(value instanceof ArrayBuffer)) {
      throw new Error('Vector should be an arrayBuffer')
    }
    const vector = new Uint8Array(value)
    let fn = new Uint8Array([getVectorFn(ctx.opts.fn)])
    const score: Uint8Array = ctx.opts.score
      ? new Uint8Array(new Float32Array([ctx.opts.score]).buffer)
      : DEFAULT_SCORE
    const buf = new Uint8Array(
      vector.byteLength + fn.byteLength + score.byteLength,
    )
    let off = 0
    off += (buf.set(new Uint8Array(vector), off), vector.byteLength)
    off += (buf.set(fn, off), fn.byteLength)
    buf.set(score, off)
    value = buf
  }

  if (
    value instanceof Uint8Array ||
    typeof value === 'string' ||
    !prop.separate ||
    ctx.operation !== EQUAL
  ) {
    if (typeof value === 'string') {
      value = ENCODER.encode(value.normalize('NFKD'))
    }
    if (prop.typeIndex === TEXT) {
      // 1 + size
      const fallbacksSize = lang.lang === 0 ? 0 : lang.fallback.length
      const tmp = new Uint8Array(value.byteLength + 2 + fallbacksSize)
      tmp.set(value)
      tmp[tmp.byteLength - 1] = fallbacksSize
      tmp[tmp.byteLength - 2] = lang.lang
      for (let i = 0; i < fallbacksSize; i++) {
        tmp[tmp.byteLength - 2 - fallbacksSize + i] = lang.fallback[i]
      }
      value = tmp
    }
  }
  if (value?.BYTES_PER_ELEMENT > 1) {
    value = value.buffer
  }
  if (!(value instanceof Uint8Array || value instanceof ArrayBuffer)) {
    throw new Error(`Incorrect value for filter: ${prop.path}`)
  }
  if (ctx.operation === LIKE && prop.typeIndex !== VECTOR) {
    const tmp = new Uint8Array(value.byteLength + 1)
    tmp.set(value instanceof ArrayBuffer ? new Uint8Array(value) : value)
    tmp[tmp.byteLength - 1] = ctx.opts.score ?? 2
    value = tmp
  }
  return value
}

export const createVariableFilterBuffer = (
  value: any,
  prop: PropDef | PropDefEdge,
  ctx: FilterCtx,
  lang: QueryDef['lang'],
): FilterCondition => {
  let mode: FILTER_MODE = MODE_DEFAULT_VAR
  let val: any
  let parsedCondition: FilterCondition
  if (Array.isArray(value)) {
    if (ctx.operation !== EQUAL || !prop.separate) {
      mode = MODE_OR_VAR
      const values = []
      for (const v of value) {
        const parsedValue = parseValue(v, prop, ctx, lang)
        const size = new Uint8Array(2)
        writeUint16(size, parsedValue.byteLength, 0)
        values.push(size, parsedValue)
      }
      val = concatUint8Arr(values)
    } else {
      const x = []
      for (const v of value) {
        x.push(parseValue(v, prop, ctx, lang))
      }
      val = x
    }
  } else {
    val = parseValue(value, prop, ctx, lang)
  }

  if (
    ctx.operation === EQUAL ||
    ctx.operation === INCLUDES ||
    ctx.operation === LIKE ||
    ctx.operation === INCLUDES_TO_LOWER_CASE
  ) {
    if (prop.separate) {
      if (
        ctx.operation === EQUAL &&
        prop.typeIndex !== ALIAS &&
        prop.typeIndex !== VECTOR
      ) {
        if (prop.typeIndex === TEXT) {
          const fbLen = 2 + val[val.byteLength - 1]
          const crc = crc32(val.slice(0, -fbLen))
          const len = val.byteLength - fbLen
          const v = new Uint8Array(8 + fbLen)
          writeUint32(v, crc, 0)
          writeUint32(v, len, 4)
          for (let i = 0; i < fbLen; i++) {
            v[v.byteLength - (i + 1)] = val[val.byteLength - (i + 1)]
          }
          parsedCondition = {
            buffer: writeVarFilter(mode, v, ctx, prop, 0, 0),
            propDef: prop,
          }
        } else {
          parsedCondition = createFixedFilterBuffer(
            prop,
            8,
            {
              operation: EQUAL_CRC32,
              type: ctx.type,
              opts: ctx.opts,
              typeId: ctx.typeId,
            },
            val,
            false,
          )
        }
      } else {
        if (val instanceof ArrayBuffer) {
          val = new Uint8Array(val)
        }
        parsedCondition = {
          buffer: writeVarFilter(mode, val, ctx, prop, 0, 0),
          propDef: prop,
        }
      }
    } else {
      parsedCondition = {
        buffer: writeVarFilter(mode, val, ctx, prop, prop.start, prop.len),
        propDef: prop,
      }
    }
  }
  return parsedCondition
}

function writeVarFilter(
  mode: FILTER_MODE,
  val: Uint8Array,
  ctx: FilterCtx,
  prop: PropDef | PropDefEdge,
  start: number,
  len: number,
): Uint8Array {
  const size = val.byteLength
  const buf = new Uint8Array(12 + size)
  buf[0] = ctx.type
  buf[1] = mode
  buf[2] = prop.typeIndex
  writeUint16(buf, start, 3)
  writeUint16(buf, len, 5)
  writeUint32(buf, size, 7)
  buf[11] = ctx.operation
  buf.set(val, 12)
  return buf
}
