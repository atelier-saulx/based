import {
  PropDef,
  PropDefEdge,
  BINARY,
  STRING,
  REFERENCES,
} from '../../../server/schema/types.js'
import { propIsSigned } from '../../../server/schema/utils.js'
import {
  EQUAL,
  FilterCtx,
  MODE_AND_FIXED,
  MODE_DEFAULT,
  MODE_OR_FIXED,
} from './operators.js'
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

export const writeFixed = (
  prop: PropDef | PropDefEdge,
  buf: Buffer,
  value: any,
  size: number,
  offset: number,
) => {
  if (prop.typeIndex === BINARY || prop.typeIndex === STRING) {
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

export const createFixedFilterBuffer = (
  prop: PropDef | PropDefEdge,
  size: number,
  ctx: FilterCtx,
  value: any,
  sort: boolean,
) => {
  let buf: Buffer
  const start = prop.start

  if (Array.isArray(value)) {
    // [or = 1] [size 2] [start 2] [op], [repeat 2], value[size] value[size] value[size]
    const len = value.length
    buf = Buffer.allocUnsafe(10 + len * size)
    buf[0] = ctx.type
    buf[1] =
      prop.typeIndex === REFERENCES && ctx.operation === EQUAL
        ? MODE_AND_FIXED
        : MODE_OR_FIXED
    buf.writeUInt16LE(size, 2)
    buf.writeUInt16LE(start, 4)
    buf[6] = ctx.operation
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
        )
      }
    }
  } else {
    // [or = 0] [size 2] [start 2], [op], value[size]
    buf = Buffer.allocUnsafe(8 + size)
    buf[0] = ctx.type
    buf[1] = MODE_DEFAULT
    buf.writeUInt16LE(size, 2)
    buf.writeUInt16LE(start, 4)
    buf[6] = ctx.operation
    buf[7] = prop.typeIndex
    writeFixed(prop, buf, parseFilterValue(prop, value), size, 8)
  }
  return buf
}
