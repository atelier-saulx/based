import { convertToTimestamp } from '@based/utils'
import {
  TypeIndex,
  PropDef,
  PropDefEdge,
  ALIAS,
  BINARY,
  JSON,
  BOOLEAN,
  CARDINALITY,
  TIMESTAMP,
  INT16,
  INT32,
  INT8,
  UINT8,
  UINT16,
  UINT32,
  NUMBER,
  ENUM,
  ID,
  MICRO_BUFFER,
  REFERENCE,
  REFERENCES,
  STRING,
  TEXT,
  ALIASES,
  VECTOR,
  COLVEC,
  NULL,
  OBJECT,
} from './types.js'
import { MAX_ID, MIN_ID } from '../types.js'

export type Validation = (payload: any, prop: PropDef | PropDefEdge) => boolean
const EPSILON = 1e-9 // Small tolerance for floating point comparisons

export const VALIDATION_MAP: Record<TypeIndex, Validation> = {
  [NULL]: () => true,
  [OBJECT]: () => true,
  [COLVEC]: () => true,
  [ALIAS]: (value) => {
    if (typeof value !== 'string') {
      return false
    }
    return true
  },
  [BINARY]: (value) => {
    if (value instanceof Uint8Array) {
      return true
    }
    return false
  },
  [BOOLEAN]: (value) => {
    if (typeof value !== 'boolean') {
      return false
    }
    return true
  },
  [CARDINALITY]: (val) => {
    return (
      typeof val === 'string' ||
      (val instanceof Uint8Array && val.byteLength === 8)
    )
  },
  [TIMESTAMP]: (value, t) => {
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
  [INT16]: (value, t) => {
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
  [INT32]: (value, t) => {
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
  [INT8]: (value, t) => {
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
  [UINT8]: (value, t) => {
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
  [UINT16]: (value, t) => {
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
  [UINT32]: (value, t) => {
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
  [NUMBER]: (value, t) => {
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
  [ENUM]: (value, prop) => {
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
  [ID]: (value) => {
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    return true
  },
  [JSON]: (value) => {
    // mep
    return true
  },
  [MICRO_BUFFER]: (value) => {
    if (!(value instanceof Uint8Array)) {
      return false
    }
    return true
  },
  [REFERENCE]: (v) => {
    if (typeof v !== 'number') {
      return false
    }
    if (v === 0 || v > MAX_ID) {
      return false
    }
    return true
  },
  [REFERENCES]: (v) => {
    if (typeof v !== 'number') {
      return false
    }
    if (v === 0 || v > MAX_ID) {
      return false
    }
    return true
  },
  [STRING]: (value, t) => {
    // add max etc all here - make a ref to the original SCHEMA on DEF
    if (typeof value !== 'string' && !(value instanceof Uint8Array)) {
      return false
    }
    return true
  },
  [TEXT]: (value, t) => {
    // add max etc all here - make a ref to the original SCHEMA on DEF
    if (typeof value !== 'string' && !(value instanceof Uint8Array)) {
      return false
    }
    return true
  },
  [ALIASES]: (value) => {
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
  [VECTOR]: (value) => {
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
