import type { SchemaCardinality, SchemaProp, SchemaVector } from '../index.js'
import {
  ALIAS,
  ALIASES,
  BINARY,
  COLVEC,
  INT16,
  INT32,
  INT8,
  NUMBER,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  REVERSE_SIZE_MAP,
  SIZE_MAP,
  STRING,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
  VECTOR_BASE_TYPE_SIZE_MAP,
  VectorBaseType,
} from './types.js'
import { convertToTimestamp } from '../../utils/index.js'

export function isSeparate(schemaProp: SchemaProp<true>, len: number) {
  return (
    len === 0 || schemaProp.type === 'vector' || schemaProp.type === 'colvec'
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
  vector: SchemaVector['baseType'],
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
    default:
      throw 'SchemaVector baseType'
  }
}

export const cardinalityModeToEnum = (mode: SchemaCardinality['mode']) => {
  if (mode === 'dense') return 1
  else 0
}

export function getPropLen(schemaProp: SchemaProp<true>) {
  let len = SIZE_MAP[schemaProp.type]
  if (
    schemaProp.type === 'string' ||
    schemaProp.type === 'alias' ||
    schemaProp.type === 'cardinality'
  ) {
    if (typeof schemaProp === 'object') {
      if (schemaProp.maxBytes && schemaProp.maxBytes < 61) {
        len = schemaProp.maxBytes + 1
      } else if ('max' in schemaProp && schemaProp.max && schemaProp.max < 31) {
        len = schemaProp.max * 2 + 1
      }
    }
  } else if (schemaProp.type === 'vector') {
    len = 4 * schemaProp.size
  } else if (schemaProp.type === 'colvec') {
    len =
      schemaProp.size *
      VECTOR_BASE_TYPE_SIZE_MAP[
        schemaVectorBaseTypeToEnum(schemaProp.baseType) ??
          VectorBaseType.Float64
      ]
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

export const sortMainProps = (
  a: PropDef | PropDefEdge,
  b: PropDef | PropDefEdge,
) => {
  const sizeA = REVERSE_SIZE_MAP[a.typeIndex]
  const sizeB = REVERSE_SIZE_MAP[b.typeIndex]
  if (sizeA === 8) {
    return -1
  }
  if (sizeA === 4 && sizeB !== 8) {
    return -1
  }
  if (sizeA === sizeB) {
    return 0
  }
  return 1
}

export const propIndexOffset = (prop: PropDef) => {
  if (!prop.separate) {
    return 0
  }

  switch (prop.typeIndex) {
    case STRING:
    case BINARY:
      return prop.default ? -400 : 0
    case REFERENCES:
    case REFERENCE:
      return -300
    case ALIAS:
    case ALIASES:
    case COLVEC:
      return 300
    default:
      return 0
  }
}

export const reorderProps = (props: PropDef[]) => {
  props.sort(
    (a, b) => a.prop + propIndexOffset(a) - (b.prop + propIndexOffset(b)),
  )

  // Reassign prop indices
  let lastProp = 0
  for (const p of props) {
    if (p.separate) {
      p.prop = ++lastProp
    }
  }
}
