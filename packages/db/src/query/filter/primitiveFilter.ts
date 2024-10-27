import { buffer } from 'stream/consumers'
import {
  PropDef,
  PropDefEdge,
  REFERENCES,
  REVERSE_SIZE_MAP,
} from '../../schema/types.js'
import { QueryDefFilter } from '../types.js'
import { Operator, operationToByte } from './operators.js'

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

export const primitiveFilter = (
  prop: PropDef | PropDefEdge,
  operator: Operator,
  value: any,
  conditions: QueryDefFilter,
) => {
  const fieldIndexChar = prop.prop
  let buf: Buffer

  let or = 0
  const op = operationToByte(operator)
  const start = prop.start ?? 0
  let size = 0

  const bufferMap = prop.__isEdge ? conditions.edges : conditions.conditions

  if (REVERSE_SIZE_MAP[prop.typeIndex] === 8) {
    if (Array.isArray(value)) {
      // [or = 1] [size 2] [start 2] [op], [repeat 2], value[size] value[size] value[size]
      or = 1
      const len = value.length
      const size = len * 8
      buf = Buffer.allocUnsafe(6 + size + 2)
      buf[0] = or
      buf.writeUInt16LE(8, 1)
      buf.writeUInt16LE(start, 3)
      buf[5] = op
      buf.writeUInt16LE(len, 6)
      for (let i = 0; i < len; i++) {
        buf.writeDoubleLE(value[i], 8 + i * 8)
      }
    } else {
      // [or = 0] [size 2] [start 2], [op], value[size]
      buf = Buffer.allocUnsafe(14)
      buf[0] = or
      buf.writeUInt16LE(8, 1)
      buf.writeUInt16LE(start, 3)
      buf[5] = op
      buf.writeDoubleLE(value, 6)
    }
  } else if (
    REVERSE_SIZE_MAP[prop.typeIndex] === 4 ||
    prop.typeIndex === REFERENCES
  ) {
    if (Array.isArray(value)) {
      // [or = 1] [size 2] [start 2] [op], [repeat 2], value[size] value[size] value[size]
      or = prop.typeIndex === REFERENCES ? 3 : 1
      const len = value.length
      const size = len * 4
      buf = Buffer.allocUnsafe(6 + size + 2)
      buf[0] = or
      buf.writeUInt16LE(4, 1)
      buf.writeUInt16LE(start, 3)
      buf[5] = op
      buf.writeUInt16LE(len, 6)
      if (prop.typeIndex === REFERENCES) {
        value = new Uint32Array(value)
        value.sort()
      }
      for (let i = 0; i < len; i++) {
        buf.writeUInt32LE(value[i], 8 + i * 4)
      }
    } else {
      // [or = 0] [size 2] [start 2], [op], value[size]
      buf = Buffer.allocUnsafe(10)
      buf[0] = or
      buf.writeUInt16LE(4, 1)
      buf.writeUInt16LE(start, 3)
      buf[5] = op
      buf.writeUInt32LE(value, 6)
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
