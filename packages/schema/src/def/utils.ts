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
  VECTOR_BASE_TYPE_SIZE_MAP,
  VectorBaseType,
} from './types.js'

import { SchemaProp, SchemaVectorBaseType, isPropType } from '../types.js'
import { getPropType } from '../parse/utils.js'
import { convertToTimestamp } from '@based/utils'

export function isSeparate(schemaProp: SchemaProp, len: number) {
  return (
    len === 0 ||
    isPropType('vector', schemaProp) ||
    isPropType('colvec', schemaProp)
  )
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

export const schemaVectorBaseTypeToEnum = (
  vector: SchemaVectorBaseType,
): VectorBaseType => {
  switch (vector) {
    case 'int8':
      return VectorBaseType.Int8
    case 'uint8':
      return VectorBaseType.Uint8
    case 'int16':
      return VectorBaseType.Int16
    case 'uint16':
      return VectorBaseType.Uint16
    case 'int32':
      return VectorBaseType.Int32
    case 'uint32':
      return VectorBaseType.Uint32
    case 'float32':
      return VectorBaseType.Float32
    case 'float64':
      return VectorBaseType.Float64
    case 'number':
      return VectorBaseType.Float64
  }
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
  } else if (isPropType('colvec', schemaProp)) {
    len =
      schemaProp.size *
      VECTOR_BASE_TYPE_SIZE_MAP[schemaProp.baseType ?? 'number']
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
