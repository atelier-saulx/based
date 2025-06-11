import { ALIAS, PropDef, PropDefEdge, TEXT, VECTOR } from '@based/schema/def'
import {
  EQUAL,
  EQUAL_CRC32,
  FILTER_MODE,
  HAS,
  HAS_TO_LOWER_CASE,
  LIKE,
  MODE_DEFAULT_VAR,
  MODE_OR_VAR,
  FilterCtx,
  getVectorFn,
} from './types.js'
import { createFixedFilterBuffer } from './createFixedFilterBuffer.js'
import { crc32 } from '../../crc32.js'
import { ENCODER, concatUint8Arr } from '@saulx/utils'
import { FilterCondition, QueryDef } from '../types.js'

const DEFAULT_SCORE = new Uint8Array(new Float32Array([0.5]).buffer)

const parseValue = (
  value: any,
  prop: PropDef | PropDefEdge,
  ctx: FilterCtx,
  lang: QueryDef['lang'],
): Uint8Array => {
  let val = value

  if (ctx.operation === HAS_TO_LOWER_CASE && typeof val === 'string') {
    val = val.toLowerCase()
  }

  if (ctx.operation === LIKE && prop.typeIndex === VECTOR) {
    if (!(val instanceof ArrayBuffer)) {
      throw new Error('Vector should be an arrayBuffer')
    }
    const vector = new Uint8Array(val)
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
    val = buf
  }

  if (
    val instanceof Uint8Array ||
    typeof value === 'string' ||
    !prop.separate ||
    ctx.operation !== EQUAL
  ) {
    if (typeof val === 'string') {
      val = ENCODER.encode(val.normalize('NFKD'))
    }
    if (prop.typeIndex === TEXT) {
      // 1 + size
      const fallbacksSize = lang.lang === 0 ? 0 : lang.fallback.length
      const tmp = new Uint8Array(val.byteLength + 2 + fallbacksSize)
      tmp.set(val)

      // fallback size query[query.len - 1]
      // langcode [len - 2]
      // fallbacks [len - (2 + fallbck size)]
      // handle query
      // if (ctx.)
      tmp[tmp.byteLength - 1] = fallbacksSize
      tmp[tmp.byteLength - 2] = lang.lang
      for (let i = 0; i < fallbacksSize; i++) {
        tmp[tmp.byteLength - 2 - fallbacksSize + i] = lang.fallback[i]
      }
      console.log('flap', { tmp, fallbacksSize })

      val = tmp
    }
  }
  if (val?.BYTES_PER_ELEMENT > 1) {
    val = val.buffer
  }
  if (!(val instanceof Uint8Array || val instanceof ArrayBuffer)) {
    throw new Error(`Incorrect value for filter: ${prop.path}`)
  }
  if (ctx.operation === LIKE && prop.typeIndex !== VECTOR) {
    const tmp = new Uint8Array(val.byteLength + 1)
    tmp.set(val instanceof ArrayBuffer ? new Uint8Array(val) : val)
    tmp[tmp.byteLength - 1] = ctx.opts.score ?? 2
    val = tmp
  }
  return val
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
      const x = []
      for (const v of value) {
        const a = parseValue(v, prop, ctx, lang)
        const size = new Uint8Array(2)
        size[0] = a.byteLength
        size[1] = a.byteLength >>> 8
        x.push(size, a)
      }
      val = concatUint8Arr(x)
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
    ctx.operation === HAS ||
    ctx.operation === LIKE ||
    ctx.operation === HAS_TO_LOWER_CASE
  ) {
    if (prop.separate) {
      if (
        ctx.operation === EQUAL &&
        prop.typeIndex !== ALIAS &&
        prop.typeIndex !== VECTOR
      ) {
        if (prop.typeIndex === TEXT) {
          const crc = crc32(val.slice(0, -1))
          const len = val.byteLength - 1
          const v = new Uint8Array(9)

          v[0] = crc
          v[1] = crc >>> 8
          v[2] = crc >>> 16
          v[3] = crc >>> 24
          v[4] = len
          v[5] = len >>> 8
          v[6] = len >>> 16
          v[7] = len >>> 24
          v[8] = val[val.length - 1]

          parsedCondition = writeVarFilter(mode, v, ctx, prop, 0, 0)
        } else {
          parsedCondition = createFixedFilterBuffer(
            prop,
            8,
            {
              operation: EQUAL_CRC32,
              type: ctx.type,
              opts: ctx.opts,
            },
            val,
            false,
          )
        }
      } else {
        if (val instanceof ArrayBuffer) {
          val = new Uint8Array(val)
        }
        parsedCondition = writeVarFilter(mode, val, ctx, prop, 0, 0)
      }
    } else {
      parsedCondition = writeVarFilter(
        mode,
        val,
        ctx,
        prop,
        prop.start,
        prop.len,
      )
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
  buf[3] = start
  buf[4] = start >>> 8
  buf[5] = len
  buf[6] = len >>> 8
  buf[7] = size
  buf[8] = size >>> 8
  buf[9] = size >>> 16
  buf[10] = size >>> 24
  buf[11] = ctx.operation
  // need to pas LANG FROM QUERY
  // need to set on 12 if TEXT
  buf.set(val, 12)

  return buf
}
