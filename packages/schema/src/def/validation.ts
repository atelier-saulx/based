import { TypeIndex, TYPE_INDEX_MAP, PropDef, PropDefEdge } from './types.js'

export type Validation = (payload: any, prop: PropDef | PropDefEdge) => boolean

export const VALIDATION_MAP: Record<TypeIndex, Validation> = {
  [TYPE_INDEX_MAP.alias]: (value) => {
    if (typeof value !== 'string') {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.binary]: (value) => {
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
  [TYPE_INDEX_MAP.cardinality]: (value) => {
    const x = typeof value === 'string' || value instanceof Uint8Array
    return x
  },
  [TYPE_INDEX_MAP.timestamp]: (value, t) => {
    if (typeof value === 'string') {
      return true
    }
    if (typeof value !== 'number' || value % 1 !== 0) {
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
  [TYPE_INDEX_MAP.int16]: (value, t) => {
    if (typeof value !== 'number' || value % 1 !== 0) {
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
    if (typeof value !== 'number' || value % 1 !== 0) {
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
    if (typeof value !== 'number' || value % 1 !== 0) {
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
    if (typeof value !== 'number' || value % 1 !== 0) {
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
    if (typeof value !== 'number' || value % 1 !== 0) {
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
    if (typeof value !== 'number' || value % 1 !== 0) {
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
  [TYPE_INDEX_MAP.reference]: (value) => {
    // if (typeof value !== 'number' && value != null) {
    //   return false
    // }
    return true
  },
  [TYPE_INDEX_MAP.references]: (v) => {
    if (typeof v !== 'number') {
      return false
    }
    if (v === 0) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.string]: (value, t) => {
    // add max etc all here - make a ref to the original SCHEMA
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
