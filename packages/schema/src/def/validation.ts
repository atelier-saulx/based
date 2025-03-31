import { LangCode } from '../lang.js'
import { TypeIndex, TYPE_INDEX_MAP, PropDef, PropDefEdge } from './types.js'

// use typeIndex here
// end export them per type
// can also add validate on the prop def
// this way we can actually write custom ones
// TODO update defaults

export type Validation = (payload: any, prop: PropDef | PropDefEdge) => boolean

export const VALIDATION_MAP: Record<TypeIndex, Validation> = {
  [TYPE_INDEX_MAP.alias]: (value) => {
    if (typeof value !== 'string' && value != null) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.binary]: (value) => {
    // if (!(value instanceof Uint8Array) && value != null) {
    //   return false
    // }
    return true
  },
  [TYPE_INDEX_MAP.boolean]: (value) => {
    if (typeof value !== 'boolean' && value != null) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.cardinality]: (value) => {
    return true
  },
  [TYPE_INDEX_MAP.timestamp]: (value) => {
    if (typeof value === 'string') {
      return true // tmp
    }
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.int16]: (value) => {
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    if (value > 32767 || value < -32768) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.int32]: (value) => {
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    if (value > 2147483647 || value < -2147483648) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.int8]: (value) => {
    // use % for steps size
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    if (value > 127 || value < -128) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.uint8]: (value) => {
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    if (value > 255 || value < 0) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.uint16]: (value) => {
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    if (value > 65535 || value < 0) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.uint32]: (value) => {
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    if (value > 4294967295 || value < 0) {
      return false
    }
    return true
  },
  [TYPE_INDEX_MAP.number]: (value) => {
    if (typeof value !== 'number' && value != null) {
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
    if (typeof value !== 'string' && value != null) {
      return false
    }
    return true
  },

  [TYPE_INDEX_MAP.json]: (value) => {
    return true
  },
  [TYPE_INDEX_MAP.microbuffer]: (value) => {
    if (!(value instanceof Uint8Array) && value != null) {
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
  [TYPE_INDEX_MAP.references]: (value) => {
    // if (!Array.isArray(value)) {
    //   return false
    // }
    // const len = value.length
    // let x = true
    // for (let i = 0; i < len; i++) {
    //   if (typeof value[i] !== 'string') {
    //     x = false
    //     break
    //   }
    // }
    return true
  },
  [TYPE_INDEX_MAP.string]: (value) => {
    if (
      typeof value !== 'string' &&
      !(value instanceof Uint8Array) &&
      value != null
    ) {
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
  [TYPE_INDEX_MAP.text]: (value, prop) => {
    // need locales as well....
    if (
      typeof value !== 'string' &&
      value !== null &&
      !(value instanceof Uint8Array) &&
      value &&
      typeof value !== 'object'
    ) {
      return false
    }
    // later
    // if (
    //   lang !== 0 &&
    //   typeof value !== 'string' &&
    //   !(value instanceof Uint8Array) &&
    //   value != null
    // ) {
    //   return false
    // }
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
