import {
  ALIAS,
  PropDef,
  PropDefEdge,
  TEXT,
  VECTOR,
} from '../../../server/schema/types.js'
import {
  EQUAL,
  EQUAL_CRC32,
  HAS,
  HAS_NORMALIZE,
  HAS_TO_LOWER_CASE,
  LIKE,
  negateType,
  NOT_EQUAL,
  NOT_HAS,
  OPERATOR,
  stripNegation,
} from './operators.js'
import { createFixedFilterBuffer } from './createFixedFilterBuffer.js'
import { LangCode } from '@based/schema'

const parseValue = (
  value: any,
  prop: PropDef | PropDefEdge,
  op: OPERATOR,
  lang: LangCode,
): Buffer => {
  let val = value
  if (op === HAS_NORMALIZE && typeof val === 'string') {
    val = val.toLowerCase()
  }
  if (
    val instanceof Uint8Array ||
    typeof value === 'string' ||
    !prop.separate ||
    op !== 1
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
  // @ts-ignore TODO FDN-576
  return val
}

export const createVariableFilterBuffer = (
  value: any,
  prop: PropDef | PropDefEdge,
  op: OPERATOR,
  lang: LangCode,
) => {
  let isOr = 4
  let val: any
  let buf: Buffer
  if (Array.isArray(value)) {
    if (op !== 1 || !prop.separate) {
      isOr = 2
      const x = []
      for (const v of value) {
        const a = parseValue(v, prop, op, lang)
        const size = Buffer.allocUnsafe(2)
        size.writeUint16LE(a.byteLength)
        x.push(size, a)
      }
      val = Buffer.concat(x)
    } else {
      const x = []
      for (const v of value) {
        x.push(parseValue(v, prop, op, lang))
      }
      val = x
    }
  } else {
    val = parseValue(value, prop, op, lang)
  }

  // -------------------- PUT VARIABLES HERE
  if (
    op === EQUAL ||
    op === HAS ||
    op === LIKE ||
    op === HAS_TO_LOWER_CASE ||
    op === HAS_NORMALIZE
  ) {
    if (prop.separate) {
      if (
        op === EQUAL &&
        prop.typeIndex !== ALIAS &&
        prop.typeIndex !== VECTOR
      ) {
        // console.log('STRICT EQUAL FOR TEXT ALSO!')
        // 17 crc32 check
        buf = createFixedFilterBuffer(prop, 8, EQUAL_CRC32, val, false)
      } else {
        buf = writeVarFilter(isOr, val, op, prop, 0, 0)
      }
    } else {
      // HANDLE EQUAL
      buf = writeVarFilter(isOr, val, op, prop, prop.start, prop.len)
    }
  } else {
    console.log('OP NOT SUPPORTED YET =>', op)
  }
  return buf
}

function writeVarFilter(
  isOr: number,
  val: Buffer,
  op: OPERATOR,
  prop: PropDef | PropDefEdge,
  start: number,
  len: number,
) {
  const size = val.byteLength
  const buf = Buffer.allocUnsafe(12 + size)
  buf[0] = negateType(op)
  buf[1] = isOr
  buf.writeUInt16LE(start, 2)
  buf.writeUint16LE(len, 4)
  buf.writeUint32LE(size, 6)
  buf[10] = stripNegation(op)
  buf[11] = prop.typeIndex
  // need to pas LANG FROM QUERY
  // need to set on 12 if TEXT
  buf.set(Buffer.from(val), 12)
  return buf
}
