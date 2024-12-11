import {
  ALIAS,
  PropDef,
  PropDefEdge,
  STRING,
} from '../../../server/schema/types.js'
import { compress, crc32 } from '../../string.js'
import { negateType, stripNegation } from './operators.js'
import {
  createFixedFilterBuffer,
  writeFixed,
} from './createFixedFilterBuffer.js'

const parseValue = (
  value: any,
  prop: PropDef | PropDefEdge,
  op: number,
): Buffer => {
  let val = value
  if (op === 19 && typeof val === 'string') {
    val = val.toLowerCase()
  }
  if (val instanceof Uint8Array || !prop.separate || op !== 1) {
    val = Buffer.from(val)
  } else if (prop.typeIndex === STRING) {
    if (typeof value === 'string') {
      val = compress(value) // TODO change buffer
    }
  } else if (prop.typeIndex === ALIAS) {
    val = Buffer.from(val)
  }
  if (!(val instanceof Buffer)) {
    throw new Error('Incorrect value for filter ' + prop.path)
  }
  return val
}

export const createVariableFilterBuffer = (
  value: any,
  prop: PropDef | PropDefEdge,
  op: number,
) => {
  let isOr = 4
  let val: any
  let buf: Buffer
  if (Array.isArray(value)) {
    if (op !== 1 || !prop.separate) {
      isOr = 2
      const x = []
      for (const v of value) {
        const a = parseValue(v, prop, op)
        const size = Buffer.allocUnsafe(2)
        size.writeUint16LE(a.byteLength)
        x.push(size, a)
      }
      val = Buffer.concat(x)
    } else {
      const x = []
      for (const v of value) {
        x.push(parseValue(v, prop, op))
      }
      val = x
    }
  } else {
    val = parseValue(value, prop, op)
  }

  // --------------------
  if (op === 3 || op === 1 || op === 2 || op === 16 || op === 18 || op === 19) {
    if (prop.separate) {
      if (op === 1 && prop.typeIndex !== ALIAS) {
        // 17 crc32 check
        buf = createFixedFilterBuffer(prop, 8, 17, val, false)
      } else {
        buf = writeVarFilter(isOr, val, buf, op, prop, 0, 0)
      }
    } else {
      // HANDLE EQUAL
      buf = writeVarFilter(isOr, val, buf, op, prop, prop.start, prop.len)
    }
  } else {
    console.log('OP NOT SUPPORTED YET =>', op)
  }
  return buf
}

function writeVarFilter(
  isOr: number,
  val: Buffer,
  buf: Buffer,
  op: number,
  prop: PropDef | PropDefEdge,
  start: number,
  len: number,
) {
  const size = val.byteLength
  buf = Buffer.allocUnsafe(12 + size)
  buf[0] = negateType(op)
  buf[1] = isOr
  buf.writeUInt16LE(start, 2)
  buf.writeUint16LE(len, 4)
  buf.writeUint32LE(size, 6)
  buf[10] = stripNegation(op)
  buf[11] = prop.typeIndex
  buf.set(val, 12)
  return buf
}
