import {
  INT16,
  INT32,
  INT8,
  UINT16,
  UINT32,
  UINT8,
  NUMBER,
  TIMESTAMP,
  PropDef,
  PropDefEdge,
  SIZE_MAP,
} from './types.js'

import { SchemaProp, isPropType } from '../types.js'
import { getPropType } from '../parse/utils.js'
import { convertToTimestamp } from '@saulx/utils'

export function isSeparate(schemaProp: SchemaProp, len: number) {
  return len === 0 || isPropType('vector', schemaProp)
}

export const propIsSigned = (prop: PropDef | PropDefEdge): boolean => {
  const t = prop.typeIndex
  if (t === INT16 || t === INT32 || t === INT8) {
    return true
  }
  return false
}

export const propIsNumerical = (prop: PropDef | PropDefEdge) => {
  const t = prop.typeIndex
  if (
    t === INT16 ||
    t === INT32 ||
    t === INT8 ||
    t === UINT8 ||
    t === UINT16 ||
    t === UINT32 ||
    t === NUMBER ||
    t === TIMESTAMP
  ) {
    return true
  }
  return false
}

export function getPropLen(schemaProp: SchemaProp) {
  let len = SIZE_MAP[getPropType(schemaProp)]
  if (
    isPropType('string', schemaProp) ||
    isPropType('alias', schemaProp) ||
    isPropType('cardinality', schemaProp)
  ) {
    if (typeof schemaProp === 'object') {
      if (schemaProp.maxBytes < 61) {
        len = schemaProp.maxBytes + 1
      } else if ('max' in schemaProp && schemaProp.max < 31) {
        len = schemaProp.max * 2 + 1
      }
    }
  } else if (isPropType('vector', schemaProp)) {
    len = 4 * schemaProp.size
  }

  return len
}

export const parseMinMaxStep = (val: any) => {
  if (typeof val === 'number') {
    return val
  }
  if (typeof val === 'string') {
    if (!val.includes('now')) {
      return convertToTimestamp(val)
    }
    return val
  }
}
