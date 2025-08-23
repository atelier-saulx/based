import { readUint32 } from '@based/utils/dist/src/uint8.js'
import { QueryDef, QueryDefType } from '../types.js'
import { Item } from './types.js'
import { addProp } from './addProps.js'
import {
  ALIAS,
  BINARY,
  CARDINALITY,
  COLVEC,
  JSON,
  PropDef,
  PropDefEdge,
  STRING,
  TEXT,
  VECTOR,
} from '@based/schema/def'
import { read, readUtf8 } from '../../string.js'

const readVector = (prop: PropDef | PropDefEdge, tmp: Uint8Array) => {
  switch (prop.vectorBaseType) {
    case 'int8':
      return new Int8Array(tmp)
    case 'uint8':
      return new Uint8Array(tmp)
    case 'int16':
      return new Int16Array(tmp)
    case 'uint16':
      return new Uint16Array(tmp)
    case 'int32':
      return new Int32Array(tmp)
    case 'uint32':
      return new Uint32Array(tmp)
    case 'float32':
      return new Float32Array(tmp)
    case 'float64':
    case 'number':
      return new Float64Array(tmp)
  }
}

const readString = (
  prop: PropDef | PropDefEdge,
  buf: Uint8Array,
  offset: number,
  size: number,
) => {
  if (
    prop.typeIndex === TEXT ||
    prop.typeIndex === STRING ||
    prop.typeIndex === ALIAS
  ) {
    return read(buf, offset, size, true)
  }
  if (prop.typeIndex === JSON) {
    return global.JSON.parse(read(buf, offset, size, true))
  }
  if (prop.typeIndex === BINARY) {
    return buf.subarray(offset + 2, size + offset)
  }
}

export const readProp = (
  instruction: number,
  q: QueryDef,
  result: Uint8Array,
  i: number,
  item: Item,
) => {
  // TODO replace with a seperate EDGE typeDef
  const prop =
    q.type === QueryDefType.Edge
      ? q.target.ref.reverseSeperateEdges[instruction]
      : q.schema.reverseProps[instruction]

  if (prop.typeIndex === CARDINALITY) {
    const size = readUint32(result, i)
    addProp(q, prop, readUint32(result, i + 4), item)
    i += size + 4
  } else if (prop.typeIndex === JSON) {
    const size = readUint32(result, i)
    addProp(q, prop, readString(prop, result, i + 4, size), item)
    i += size + 4
  } else if (prop.typeIndex === BINARY) {
    const size = readUint32(result, i)
    addProp(q, prop, readString(prop, result, i + 4, size), item)
    i += size + 4
  } else if (prop.typeIndex === STRING) {
    console.log('???', i)
    const size = readUint32(result, i)
    addProp(q, prop, readString(prop, result, i + 4, size), item)
    i += size + 4
  } else if (prop.typeIndex == TEXT) {
    const size = readUint32(result, i)
    if (size === 0) {
      // do nothing
    } else {
      if (q.lang.lang != 0) {
        addProp(q, prop, read(result, i + 4, size, true), item)
      } else {
        addProp(q, prop, read(result, i + 4, size, true), item, result[i + 4])
      }
    }
    i += size + 4
  } else if (prop.typeIndex === ALIAS) {
    // ALIASES
    const size = readUint32(result, i)
    i += 4
    if (size === 0) {
      addProp(q, prop, '', item)
    } else {
      const string = readUtf8(result, i, size)
      i += size
      addProp(q, prop, string, item)
    }
  } else if (prop.typeIndex === VECTOR || prop.typeIndex === COLVEC) {
    const size = readUint32(result, i)
    i += 4
    const tmp = result.subarray(i, i + size) // Make a copy
    addProp(q, prop, readVector(prop, tmp), item)
    i += size
  }
  return i
}
