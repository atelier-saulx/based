import {
  PropDef,
  PropDefEdge,
  BINARY,
  STRING,
  REFERENCES,
} from '@based/schema/def'
import {
  EQUAL,
  FilterCtx,
  MODE_AND_FIXED,
  MODE_DEFAULT,
  MODE_OR_FIXED,
} from './types.js'
import { parseFilterValue } from './parseFilterValue.js'
import { ENCODER } from '../../../utils.js'
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
      // RFE no int64 for u? prob important to add...
      const view = new DataView(buf.buffer, buf.byteOffset)
      view.setFloat64(offset, value, true)
    } else if (size === 4) {
      buf[offset] = value
      buf[offset + 1] = value >>> 8
      buf[offset + 2] = value >>> 16
      buf[offset + 3] = value >>> 24
    } else if (size === 2) {
      buf[offset] = value
      buf[offset + 1] = value >>> 8
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
    const buf = new Uint8Array(10 + len * size)
    buf[0] = ctx.type
    buf[1] =
      prop.typeIndex === REFERENCES && ctx.operation === EQUAL
        ? MODE_AND_FIXED
        : MODE_OR_FIXED

    buf[2] = prop.typeIndex
    buf[3] = size
    buf[4] = size >>> 8
    buf[5] = start
    buf[6] = start >>> 8
    buf[7] = ctx.operation
    buf[8] = len
    buf[9] = len >>> 8
    if (sort) {
      value = new Uint32Array(value.map((v) => parseFilterValue(prop, v)))
      value.sort()
      for (let i = 0; i < len; i++) {
        const off = 10 + i * size
        const val = value[i]
        buf[off] = val
        buf[off + 1] = val >>> 8
        buf[off + 2] = val >>> 16
        buf[off + 3] = val >>> 24
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
    console.log('IS OR', buf[1] == MODE_OR_FIXED)
    return { buf, align: true }
  } else {
    const buf = new Uint8Array(8 + size)
    buf[0] = ctx.type
    buf[1] = MODE_DEFAULT
    buf[2] = prop.typeIndex
    buf[3] = size
    buf[4] = size >>> 8
    buf[5] = start
    buf[6] = start >>> 8
    buf[7] = ctx.operation
    writeFixed(prop, buf, parseFilterValue(prop, value), size, 8)
    return { buf, align: false }
  }
}
