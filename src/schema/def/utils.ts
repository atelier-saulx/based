import {
  type SchemaCardinality,
  type SchemaProp,
  type SchemaVector,
} from '../index.js'
import {
  PropDef,
  PropDefEdge,
  REVERSE_SIZE_MAP,
  SIZE_MAP,
  VECTOR_BASE_TYPE_SIZE_MAP,
} from './types.js'
import {
  convertToTimestamp,
  writeDoubleLE,
  writeInt16,
  writeInt32,
  writeInt64,
  writeUint16,
  writeUint32,
} from '../../utils/index.js'
import {
  PropType,
  PropTypeEnum,
  VectorBaseType,
  VectorBaseTypeEnum,
  VectorBaseTypeInverse,
} from '../../zigTsExports.js'

export function isSeparate(schemaProp: SchemaProp<true>, len: number) {
  return (
    len === 0 || schemaProp.type === 'vector' || schemaProp.type === 'colvec'
  )
}

export const propIsNumerical = (prop: PropDef | PropDefEdge) => {
  const t = prop.typeIndex
  if (
    t === PropType.int8 ||
    t === PropType.int16 ||
    t === PropType.int32 ||
    t === PropType.uint8 ||
    t === PropType.uint16 ||
    t === PropType.uint32 ||
    t === PropType.number ||
    t === PropType.timestamp
  ) {
    return true
  }
  return false
}

export const schemaVectorBaseTypeToEnum = (
  vector: SchemaVector['baseType'],
): VectorBaseTypeEnum => {
  if (vector === 'number' || vector === undefined) {
    return VectorBaseType.float64
  }
  return VectorBaseTypeInverse[vector]
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
          VectorBaseType.float64
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
    case PropType.microBuffer:
    case PropType.vector:
      return prop.default ? -600 : 0
    case PropType.string:
    case PropType.binary:
    case PropType.json:
      return prop.default ? -500 : 0
    case PropType.text:
      return prop.default ? -400 : 0
    case PropType.references:
    case PropType.reference:
      return -300
    case PropType.alias:
    case PropType.aliases:
    case PropType.colVec:
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

const writeUint8 = (dest: Uint8Array, val: number, offset: number) => {
  dest[offset] = val
  return dest
}

const writeInt8 = writeUint8

const propWriter = {
  [PropType.int8]: writeInt8,
  [PropType.uint8]: writeUint8,
  [PropType.int16]: writeInt16,
  [PropType.uint16]: writeUint16,
  [PropType.int32]: writeInt32,
  [PropType.uint32]: writeUint32,
  [PropType.number]: writeDoubleLE,
  [PropType.timestamp]: writeInt64,
  [PropType.boolean]: (dest: Uint8Array, val: boolean, offset: number) => {
    dest[offset] = val ? 1 : 0
    return dest
  },
}

export const getPropWriter = (
  propType: PropTypeEnum,
): ((buf: Uint8Array, val: any, offset: number) => Uint8Array) => {
  const write = propWriter[propType]
  if (!write) {
    return (buf: Uint8Array, val: any, offset: number) => buf
  }
  return write
}
