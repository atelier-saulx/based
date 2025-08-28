import {
  PropDef,
  PropDefEdge,
  BINARY,
  STRING,
  REFERENCES,
  TIMESTAMP,
} from '@based/schema/def'
import {
  ALIGNMENT_NOT_SET,
  EQUAL,
  FilterCtx,
  MODE_AND_FIXED,
  MODE_DEFAULT,
  MODE_OR_FIXED,
} from './types.js'
import { parseFilterValue } from './parseFilterValue.js'
import {
  ENCODER,
  writeDoubleLE,
  writeInt64,
  writeUint16,
  writeUint32,
} from '@based/utils'
import { FilterCondition } from '../types.js'

export const writeFixed = (
  prop: PropDef | PropDefEdge,
  buf: Uint8Array,
  value: any,
  size: number,
  offset: number,
) => {
  if (prop.typeIndex === BINARY || prop.typeIndex === STRING) {
    if (typeof value === 'string') {
      const { written } = ENCODER.encodeInto(value, buf.subarray(offset + 1))
      buf[offset] = written
    } else if (value instanceof Uint8Array) {
      buf.set(value, offset)
    } else {
      throw new Error('Incorrect filter value for ' + prop.path)
    }
  } else if (size === 1) {
    buf[offset] = value
  } else {
    if (size === 8) {
      if (prop.typeIndex === TIMESTAMP) {
        writeInt64(buf, value, offset)
      } else {
        writeDoubleLE(buf, value, offset)
      }
    } else if (size === 4) {
      writeUint32(buf, value, offset)
    } else if (size === 2) {
      writeUint16(buf, value, offset)
    } else if (size === 1) {
      buf[offset] = value
    }
  }
}

export const createFixedFilterBuffer = (
  prop: PropDef | PropDefEdge,
  size: number,
  ctx: FilterCtx,
  value: any,
  sort: boolean,
): FilterCondition => {
  const start = prop.start
  if (Array.isArray(value)) {
    const len = value.length
    // Add 8 extra bytes for alignment
    const buf = new Uint8Array(18 + len * size)
    buf[0] = ctx.type
    buf[1] =
      prop.typeIndex === REFERENCES && ctx.operation === EQUAL
        ? MODE_AND_FIXED
        : MODE_OR_FIXED
    buf[2] = prop.typeIndex
    writeUint16(buf, size, 3)
    writeUint16(buf, start, 5)
    buf[7] = ctx.operation
    writeUint16(buf, len, 8)
    buf[10] = ALIGNMENT_NOT_SET
    if (sort) {
      value = new Uint32Array(value.map((v) => parseFilterValue(prop, v)))
      value.sort()
      for (let i = 0; i < len; i++) {
        writeUint32(buf, value[i], 18 + i * size)
      }
    } else {
      for (let i = 0; i < len; i++) {
        writeFixed(
          prop,
          buf,
          parseFilterValue(prop, value[i]),
          size,
          18 + i * size,
        )
      }
    }
    return buf
  } else {
    const buf = new Uint8Array(8 + size)
    buf[0] = ctx.type
    buf[1] = MODE_DEFAULT
    buf[2] = prop.typeIndex
    writeUint16(buf, size, 3)
    writeUint16(buf, start, 5)
    buf[7] = ctx.operation
    writeFixed(prop, buf, parseFilterValue(prop, value), size, 8)
    return buf
  }
}
