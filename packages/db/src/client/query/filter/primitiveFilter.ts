import {
  BINARY,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  REVERSE_SIZE_MAP,
  STRING,
} from '../../../server/schema/types.js'
import { propIsSigned } from '../../../server/schema/utils.js'
import { QueryDefFilter } from '../types.js'
import {
  isNumerical,
  operationToByte,
  stripNegation,
  negateType,
} from './operators.js'
import { parseFilterValue } from './parseFilterValue.js'
import { Filter } from './types.js'
import { compress, crc32 } from '../../string.js'

// -------------------------------------------
// conditions normal
// field, [size 2]
// [or = 0] [size 2] [start 2], [op], value[size]
// -------------------------------------------
// conditions or fixed
// field, [size 2]
// [or = 1] [size 2] [start 2] [op], [repeat 2], value[size] value[size] value[size]
// -------------------------------------------
// conditions or variable
// field, [size 2]
// [or = 2] [size 2] [start 2], [op], [size 2], value[size], [size 2], value[size]
// -------------------------------------------
const writeFixed = (
  prop: PropDef | PropDefEdge,
  buf: Buffer,
  value: any,
  size: number,
  offset: number,
  op: number,
) => {
  if ((prop.typeIndex === BINARY || prop.typeIndex === STRING) && op !== 17) {
    if (typeof value === 'string') {
      const size = buf.write(value, offset + 1, 'utf8')
      buf[offset] = size
    } else if (value instanceof Buffer) {
      buf.set(value, offset)
    } else {
      throw new Error('Incorrect filter value for ' + prop.path)
    }
  } else if (size === 1) {
    buf[offset] = value
  } else {
    if (size === 8) {
      buf.writeDoubleLE(value, offset)
    } else if (propIsSigned(prop)) {
      if (size === 4) {
        buf.writeInt32LE(value, offset)
      } else if (size === 2) {
        buf.writeInt16LE(value, offset)
      } else if (size === 1) {
        buf[offset] = value
      }
    } else if (size === 4) {
      buf.writeUInt32LE(value, offset)
    } else if (size === 2) {
      buf.writeUInt16LE(value, offset)
    }
  }
}

// Modes
// default = 0,
// orFixed = 1,
// orVar = 2,
const createFixedFilterBuffer = (
  prop: PropDef | PropDefEdge,
  size: number,
  op: number,
  value: any,
  sort: boolean,
) => {
  let buf: Buffer
  const start = prop.start

  if (Array.isArray(value)) {
    // [or = 1] [size 2] [start 2] [op], [repeat 2], value[size] value[size] value[size]
    const len = value.length
    buf = Buffer.allocUnsafe(10 + len * size)
    buf[0] = negateType(op)
    buf[1] = prop.typeIndex === REFERENCES && op === 1 ? 3 : 1
    buf.writeUInt16LE(size, 2)
    buf.writeUInt16LE(start, 4)
    buf[6] = stripNegation(op)
    buf[7] = prop.typeIndex
    buf.writeUInt16LE(len, 8)
    if (sort) {
      value = new Uint32Array(value.map((v) => parseFilterValue(prop, v)))
      value.sort()
      for (let i = 0; i < len; i++) {
        buf.writeUInt32LE(value[i], 10 + i * size)
      }
    } else {
      for (let i = 0; i < len; i++) {
        writeFixed(
          prop,
          buf,
          parseFilterValue(prop, value[i]),
          size,
          10 + i * size,
          op,
        )
      }
    }
  } else {
    // [or = 0] [size 2] [start 2], [op], value[size]
    buf = Buffer.allocUnsafe(8 + size)
    buf[0] = negateType(op)
    buf[1] = 0
    buf.writeUInt16LE(size, 2)
    buf.writeUInt16LE(start, 4)
    buf[6] = stripNegation(op)
    buf[7] = prop.typeIndex
    writeFixed(prop, buf, parseFilterValue(prop, value), size, 8, op)
  }

  return buf
}

const createReferenceFilter = (
  prop: PropDef | PropDefEdge,
  op: number,
  value: any,
) => {
  let buf: Buffer
  const len = Array.isArray(value) ? value.length : 1
  buf = Buffer.allocUnsafe(11 + len * 8)
  buf[0] = negateType(op)
  buf[1] = 5
  buf.writeUInt16LE(8, 2)
  buf.writeUInt16LE(len, 4)
  buf[6] = stripNegation(op)
  buf[7] = prop.typeIndex
  buf[8] = 0
  buf.writeUInt16LE(prop.inverseTypeId, 9)
  if (Array.isArray(value)) {
    for (let i = 0; i < len; i++) {
      buf.writeUInt32LE(value[i], 11 + i * 8)
    }
  } else {
    buf.writeUInt32LE(value, 11)
  }
  return buf
}

export const primitiveFilter = (
  prop: PropDef | PropDefEdge,
  filter: Filter,
  conditions: QueryDefFilter,
) => {
  let [, operator, value] = filter
  const fieldIndexChar = prop.prop
  let buf: Buffer
  const op = operationToByte(operator)
  let size = 0

  const bufferMap = prop.__isEdge ? conditions.edges : conditions.conditions
  const isArray = Array.isArray(value)
  if (isArray && value.length === 1) {
    value = value[0]
  }

  const propSize = REVERSE_SIZE_MAP[prop.typeIndex]

  if (prop.typeIndex === REFERENCE) {
    buf = createReferenceFilter(prop, op, value)
  } else if (prop.typeIndex === REFERENCES) {
    if (op === 1 && !isArray) {
      value = [value]
    }
    buf = createFixedFilterBuffer(prop, 4, op, value, !isNumerical(op))
  } else if (propSize) {
    buf = createFixedFilterBuffer(prop, propSize, op, value, false)
  } else {
    let val = value

    if (val instanceof Uint8Array) {
      val = Buffer.from(val)
    } else if (prop.typeIndex === STRING && typeof value === 'string') {
      // dont need this
      val = compress(value)
    }
    // If string > x dont do this then we jusrt check crc32

    // if val > certain amount will compare crc32 + len
    // fixed

    if (!(val instanceof Buffer)) {
      throw new Error('Incorrect value for filter ' + prop.path)
    }

    // --------------------

    if (op === 3 || op === 1 || op === 2 || op === 16) {
      if (prop.separate) {
        // if val.bytelen > 100

        if (op === 1 && val.byteLength > 100) {
          // ADD ARRAY SUPPORT!
          buf = createFixedFilterBuffer(prop, 4, 17, crc32(val), false)

          // [or = 0] [size 2] [start 2], [op], value[size]
          buf = Buffer.allocUnsafe(16)
          buf[0] = negateType(op)
          buf[1] = 0
          buf.writeUInt16LE(8, 2)
          buf.writeUInt16LE(0, 4)
          buf[6] = 17
          buf[7] = prop.typeIndex
          writeFixed(prop, buf, crc32(val), 4, 8, 17)
          writeFixed(prop, buf, val.byteLength, 4, 12, 17)
        } else {
          // make hash and compare that
          // make a seperate operation for hash + len comparison
          //  (only for VAR)
          // maybe just do crc32 so we dont need to increase size everywhere...
          // [or = 4] [size 2], [0x0], [op] [typeIndex], value[size]
          const size = val.byteLength
          buf = Buffer.allocUnsafe(8 + size)
          buf[0] = negateType(op)
          buf[1] = 4 // var size
          buf.writeUint32LE(size, 2)
          buf[6] = stripNegation(op)
          buf[7] = prop.typeIndex
          buf.set(val, 8)
        }
        // SET copy in
      }
      // else do
    } else {
      console.log('SNURP', op)
    }
  }

  // ADD OR if array for value
  let arr = bufferMap.get(fieldIndexChar)
  if (!arr) {
    size += 3 // [field] [size 2]
    arr = []
    bufferMap.set(fieldIndexChar, arr)
  }

  size += buf.byteLength
  arr.push(buf)
  return size
}
