import {
  NUMBER,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  REVERSE_SIZE_MAP,
  TypeIndex,
} from '../../schema/types.js'
import { propIsSigned } from '../../schema/utils.js'
import { QueryDefFilter } from '../types.js'
import { Operator, isNumerical, operationToByte } from './operators.js'
import { parseFilterValue } from './parseFilterValue.js'

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

const write = (
  prop: PropDef | PropDefEdge,
  buf: Buffer,
  value: any,
  size: number,
  offset: number,
) => {
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
  } else if (size === 1) {
    buf[offset] = value
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
    buf = Buffer.allocUnsafe(9 + len * size)
    buf[0] = prop.typeIndex === REFERENCES && op === 1 ? 3 : 1
    buf.writeUInt16LE(size, 1)
    buf.writeUInt16LE(start, 3)
    buf[5] = op
    buf[6] = prop.typeIndex
    buf.writeUInt16LE(len, 7)
    if (sort) {
      value = new Uint32Array(value.map((v) => parseFilterValue(prop, v)))
      value.sort()
      for (let i = 0; i < len; i++) {
        buf.writeUInt32LE(value[i], 9 + i * size)
      }
    } else {
      for (let i = 0; i < len; i++) {
        write(prop, buf, parseFilterValue(prop, value[i]), size, 9 + i * size)
      }
    }
  } else {
    // [or = 0] [size 2] [start 2], [op], value[size]
    buf = Buffer.allocUnsafe(7 + size)
    buf[0] = 0
    buf.writeUInt16LE(size, 1)
    buf.writeUInt16LE(start, 3)
    buf[5] = op
    buf[6] = prop.typeIndex
    write(prop, buf, parseFilterValue(prop, value), size, 7)
  }
  return buf
}

const createReferenceFilter = (
  prop: PropDef | PropDefEdge,
  op: number,
  value: any,
) => {
  let buf: Buffer
  // [or = 1]  [repeat 2] [op] [ti] [parsed] [typeId 2], value[size] value[size] value[size]
  const len = Array.isArray(value) ? value.length : 1
  buf = Buffer.allocUnsafe(10 + len * 8)
  buf[0] = 0
  buf.writeUInt16LE(8, 1)
  buf.writeUInt16LE(len, 3)
  buf[5] = op
  buf[6] = prop.typeIndex
  buf[7] = 0
  buf.writeUInt16LE(prop.inverseTypeId, 8)
  if (Array.isArray(value)) {
    for (let i = 0; i < len; i++) {
      buf.writeUInt32LE(value[i], 10 + i * 8)
    }
  } else {
    buf.writeUInt32LE(value, 10)
  }
  return buf
}

export const primitiveFilter = (
  prop: PropDef | PropDefEdge,
  operator: Operator,
  value: any,
  conditions: QueryDefFilter,
) => {
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
    // ----
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
