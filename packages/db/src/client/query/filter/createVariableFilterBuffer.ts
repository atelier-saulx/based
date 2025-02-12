import {
  ALIAS,
  PropDef,
  PropDefEdge,
  STRING,
  TEXT,
  VECTOR,
} from '../../../server/schema/types.js'
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
  VECTOR_DOT_PRODUCT,
  VECTOR_EUCLIDEAN_DIST,
  VECTOR_COSTINE_SIMILARITY,
  VECTOR_MANHATTAN_DIST,
} from './types.js'
import { createFixedFilterBuffer } from './createFixedFilterBuffer.js'
import { LangCode } from '@based/schema'

const DEFAULT_SCORE = Buffer.from(new Float32Array([0.5]).buffer)

const parseValue = (
  value: any,
  prop: PropDef | PropDefEdge,
  ctx: FilterCtx,
  lang: LangCode,
): Buffer => {
  let val = value
  if (ctx.operation === HAS_TO_LOWER_CASE && typeof val === 'string') {
    val = val.toLowerCase()
  }

  if (ctx.operation === LIKE && prop.typeIndex === VECTOR) {
    if (!(val instanceof ArrayBuffer)) {
      throw new Error('Vector should be an arrayBuffer')
    }
    const optsFn = ctx.opts.fn
    let fn = VECTOR_COSTINE_SIMILARITY
    if (optsFn === 'dotProduct') {
      fn = VECTOR_DOT_PRODUCT
    } else if (optsFn === 'euclideanDistance') {
      fn = VECTOR_EUCLIDEAN_DIST
    } else if (optsFn === 'manhattanDistance') {
      fn = VECTOR_MANHATTAN_DIST
    }
    const score = ctx.opts.score
      ? Buffer.from(new Float32Array([ctx.opts.score]).buffer)
      : DEFAULT_SCORE
    val = Buffer.concat([Buffer.from(val), Buffer.from([fn]), score])
  }

  if (
    val instanceof Uint8Array ||
    typeof value === 'string' ||
    !prop.separate ||
    ctx.operation !== EQUAL
  ) {
    if (prop.typeIndex === TEXT) {
      // can be optmized replace when using uint8array
      val = Buffer.concat([Buffer.from(val), Buffer.from([lang])])
    } else {
      val = Buffer.from(val)
    }
  }
  if (val?.BYTES_PER_ELEMENT > 1) {
    val = val.buffer
  }
  if (!(val instanceof Buffer || val instanceof ArrayBuffer)) {
    throw new Error(`Incorrect value for filter: ${prop.path}`)
  }

  if (ctx.operation === LIKE && prop.typeIndex !== VECTOR) {
    // @ts-ignore
    val = Buffer.concat([val, Buffer.from([ctx.opts.score ?? 2])])
  }
  // @ts-ignore TODO FDN-576
  return val
}

export const createVariableFilterBuffer = (
  value: any,
  prop: PropDef | PropDefEdge,
  ctx: FilterCtx,
  lang: LangCode,
) => {
  let mode: FILTER_MODE = MODE_DEFAULT_VAR
  let val: any
  let buf: Buffer
  if (Array.isArray(value)) {
    if (ctx.operation !== EQUAL || !prop.separate) {
      mode = MODE_OR_VAR
      const x = []
      for (const v of value) {
        const a = parseValue(v, prop, ctx, lang)
        const size = Buffer.allocUnsafe(2)
        size.writeUint16LE(a.byteLength)
        x.push(size, a)
      }
      val = Buffer.concat(x)
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

  // -------------------- PUT VARIABLES HERE
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
        // 17 crc32 check
        buf = createFixedFilterBuffer(
          prop,
          8,
          { operation: EQUAL_CRC32, type: ctx.type, opts: ctx.opts },
          val,
          false,
        )
      } else {
        buf = writeVarFilter(mode, val, ctx, prop, 0, 0)
      }
    } else {
      buf = writeVarFilter(mode, val, ctx, prop, prop.start, prop.len)
    }
  } else {
    console.log('OP NOT SUPPORTED YET =>', ctx)
  }
  return buf
}

function writeVarFilter(
  mode: FILTER_MODE,
  val: Buffer,
  ctx: FilterCtx,
  prop: PropDef | PropDefEdge,
  start: number,
  len: number,
) {
  const size = val.byteLength
  const buf = Buffer.allocUnsafe(12 + size)
  buf[0] = ctx.type
  buf[1] = mode
  buf.writeUInt16LE(start, 2)
  buf.writeUint16LE(len, 4)
  buf.writeUint32LE(size, 6)
  buf[10] = ctx.operation
  buf[11] = prop.typeIndex
  // need to pas LANG FROM QUERY
  // need to set on 12 if TEXT
  buf.set(Buffer.from(val), 12)
  return buf
}
