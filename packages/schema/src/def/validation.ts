import { convertToTimestamp } from '@saulx/utils'
import { TypeIndex, TYPE_INDEX_MAP, PropDef, PropDefEdge } from './types.js'
import { MAX_ID, MIN_ID } from '../types.js'

export type Validation = (payload: any, prop: PropDef | PropDefEdge) => boolean
const EPSILON = 1e-9 // Small tolerance for floating point comparisons

export const VALIDATION_MAP: Record<TypeIndex, Validation> = {
  [TYPE_INDEX_MAP.alias]: (value) => {
    if (typeof value !== 'string') {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.binary]: (value) => {
    console.log('DERP ', value, typeof value)
    if (value instanceof Uint8Array) {
      return true
    }
    return false
  },
  [TYPE_INDEX_MAP.boolean]: (value) => {
    if (typeof value !== 'boolean') {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.cardinality]: (val) => {
    return (
      typeof val === 'string' ||
      (val instanceof Uint8Array && val.byteLength === 8)
    )
  },
  [TYPE_INDEX_MAP.timestamp]: (value, t) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (t.min !== undefined) {
      if (typeof t.min === 'number') {
        if (value < t.min) {
          return false
        }
      } else if (value < convertToTimestamp(t.min)) {
        return false
      }
    } else {
      return value > -1
    }
    if (t.max !== undefined) {
      if (typeof t.max === 'number') {
        if (value > t.max) {
          return false
        }
      } else if (value > convertToTimestamp(t.max)) {
        return false
      }
    }
    return true
  },
  [TYPE_INDEX_MAP.int16]: (value, t) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 32767 || value < -32768) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.int32]: (value, t) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 2147483647 || value < -2147483648) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.int8]: (value, t) => {
    // use % for steps size
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 127 || value < -128) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.uint8]: (value, t) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 255 || value < 0) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.uint16]: (value, t) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 65535 || value < 0) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.uint32]: (value, t) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 4294967295 || value < 0) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.number]: (value, t) => {
    if (t.step) {
      const div = value / t.step
      if (Math.abs(div - Math.round(div)) > EPSILON) {
        return false
      }
    }
    if (typeof value !== 'number') {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.enum]: (value, prop) => {
    if (value === null) {
      return true
    }
    const arr = prop.enum
    for (let i = 0; i < arr.length; i++) {
      if (value === arr[i]) {
        return true
      }
    }
    return false
  },
  [TYPE_INDEX_MAP.id]: (value) => {
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    return true
  },

  [TYPE_INDEX_MAP.json]: (value) => {
    return true
  },
  [TYPE_INDEX_MAP.microbuffer]: (value) => {
    if (!(value instanceof Uint8Array)) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.reference]: (v) => {
    if (typeof v !== 'number') {
      return false
    }
    if (v === 0 || v > MAX_ID) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.references]: (v) => {
    if (typeof v !== 'number') {
      return false
    }
    if (v === 0 || v > MAX_ID) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.string]: (value, t) => {
    // add max etc all here - make a ref to the original SCHEMA on DEF
    if (typeof value !== 'string' && !(value instanceof Uint8Array)) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.text]: (value, t) => {
    // add max etc all here - make a ref to the original SCHEMA on DEF
    if (typeof value !== 'string' && !(value instanceof Uint8Array)) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.aliases]: (value) => {
    if (!Array.isArray(value)) {
      return false
    }
    const len = value.length
    for (let i = 0; i < len; i++) {
      if (typeof value[i] !== 'string') {
        return false
      }
    }
    return true
  },
  [TYPE_INDEX_MAP.vector]: (value) => {
    // Array should be supported
    if (!(value instanceof Float32Array)) {
      return false
    }
    return true
  },
}

export const defaultValidation = () => true

export const isValidId = (id: number) => {
  if (typeof id != 'number' || id < MIN_ID || id > MAX_ID) {
    return false
  }
  return true
}

export const isValidString = (v: any) => {
  const isVal =
    typeof v === 'string' ||
    (v as any) instanceof Uint8Array ||
    ArrayBuffer.isView(v)
  return isVal
}
