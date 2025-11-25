import {
  ALIGNMENT_NOT_SET,
  EQUAL,
  FilterCtx,
  isNumerical,
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
import { FilterCondition, FilterMetaNow } from '../types.js'
import type { PropDef, PropDefEdge } from '@based/schema'
import { PropType } from '../../../zigTsExports.js'

const isNowQuery = (
  prop: PropDef | PropDefEdge,
  value: any,
  ctx: FilterCtx,
) => {
  return (
    prop.typeIndex === PropType.timestamp &&
    typeof value === 'string' &&
    value.includes('now') &&
    isNumerical(ctx.operation)
  )
}

const createNowMeta = (
  prop: PropDef | PropDefEdge,
  parsedValue: number,
  ctx: FilterCtx,
): FilterMetaNow => {
  return {
    byteIndex: 8,
    offset: parsedValue - Date.now(),
    resolvedByteIndex: 0,
    ctx,
    prop,
  }
}

export const writeFixed = (
  prop: PropDef | PropDefEdge,
  buf: Uint8Array,
  value: any,
  size: number,
  offset: number,
) => {
  if (
    prop.typeIndex === PropType.binary ||
    prop.typeIndex === PropType.string
  ) {
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
      if (prop.typeIndex === PropType.timestamp) {
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
  const start = prop.start!
  if (Array.isArray(value)) {
    const len = value.length
    // Add 8 extra bytes for alignment
    const buffer = new Uint8Array(18 + len * size)
    const result: FilterCondition = { buffer, propDef: prop }
    buffer[0] = ctx.type
    buffer[1] =
      prop.typeIndex === PropType.references && ctx.operation === EQUAL
        ? MODE_AND_FIXED
        : MODE_OR_FIXED
    buffer[2] = prop.typeIndex
    writeUint16(buffer, size, 3)
    writeUint16(buffer, start, 5)
    buffer[7] = ctx.operation
    writeUint16(buffer, len, 8)
    buffer[10] = ALIGNMENT_NOT_SET
    if (sort) {
      value = new Uint32Array(value.map((v) => parseFilterValue(prop, v)))
      value.sort()
      for (let i = 0; i < len; i++) {
        writeUint32(buffer, value[i], 18 + i * size)
      }
    } else {
      for (let i = 0; i < len; i++) {
        const parsedValue = parseFilterValue(prop, value[i])
        if (isNowQuery(prop, value, ctx)) {
          if (!result.subscriptionMeta) {
            result.subscriptionMeta = {}
          }
          if (!result.subscriptionMeta.now) {
            result.subscriptionMeta = { now: [] }
          }
          result.subscriptionMeta.now!.push(
            createNowMeta(prop, parsedValue, ctx),
          )
        }
        writeFixed(prop, buffer, parsedValue, size, 18 + i * size)
      }
    }
    return result
  } else {
    const buffer = new Uint8Array(8 + size)
    buffer[0] = ctx.type
    buffer[1] = MODE_DEFAULT
    buffer[2] = prop.typeIndex
    writeUint16(buffer, size, 3)
    writeUint16(buffer, start, 5)
    buffer[7] = ctx.operation
    const parsedValue = parseFilterValue(prop, value)
    writeFixed(prop, buffer, parsedValue, size, 8)
    if (isNowQuery(prop, value, ctx)) {
      return {
        buffer,
        propDef: prop,
        subscriptionMeta: {
          now: [createNowMeta(prop, parsedValue, ctx)],
        },
      }
    } else {
      return { buffer, propDef: prop }
    }
  }
}
