import { readUint32, readUtf8 } from '@based/utils/dist/src/uint8.js'
import { Item, ReaderPropDef, ReaderSchema } from './types.js'
import { addProp, addLangProp } from './addProps.js'
import {
  ALIAS,
  BINARY,
  CARDINALITY,
  COLVEC,
  JSON,
  STRING,
  TEXT,
  VECTOR,
} from '@based/schema/def'
import { readString } from './string.js'
import { readVector } from './vector.js'

const readStringProp = (
  prop: ReaderPropDef,
  buf: Uint8Array,
  offset: number,
  size: number,
) => {
  if (
    prop.typeIndex === TEXT ||
    prop.typeIndex === STRING ||
    prop.typeIndex === ALIAS
  ) {
    return readString(buf, offset, size, true)
  }
  if (prop.typeIndex === JSON) {
    return global.JSON.parse(readString(buf, offset, size, true))
  }
  if (prop.typeIndex === BINARY) {
    return buf.subarray(offset + 2, size + offset)
  }
}

export const readProp = (
  instruction: number,
  q: ReaderSchema,
  result: Uint8Array,
  i: number,
  item: Item,
) => {
  const prop = q.props[instruction]
  prop.readBy = q.readId
  if (prop.typeIndex === CARDINALITY) {
    const size = readUint32(result, i)
    addProp(prop, readUint32(result, i + 4), item)
    i += size + 4
  } else if (prop.typeIndex === JSON) {
    const size = readUint32(result, i)
    addProp(prop, readStringProp(prop, result, i + 4, size), item)
    i += size + 4
  } else if (prop.typeIndex === BINARY) {
    const size = readUint32(result, i)
    addProp(prop, readStringProp(prop, result, i + 4, size), item)
    i += size + 4
  } else if (prop.typeIndex === STRING) {
    const size = readUint32(result, i)
    addProp(prop, readStringProp(prop, result, i + 4, size), item)
    i += size + 4
  } else if (prop.typeIndex == TEXT) {
    const size = readUint32(result, i)
    if (size === 0) {
      // do nothing
    } else {
      if (!prop.locales) {
        addProp(prop, readString(result, i + 4, size, true), item)
      } else {
        addLangProp(
          prop,
          readString(result, i + 4, size, true),
          item,
          result[i + 4],
        )
      }
    }
    i += size + 4
  } else if (prop.typeIndex === ALIAS) {
    const size = readUint32(result, i)
    i += 4
    if (size === 0) {
      addProp(prop, '', item)
    } else {
      const string = readUtf8(result, i, size)
      i += size
      addProp(prop, string, item)
    }
  } else if (prop.typeIndex === VECTOR || prop.typeIndex === COLVEC) {
    const tmp = result.slice(i, i + prop.len) // maybe align?
    addProp(prop, readVector(prop, tmp), item)
    i += prop.len
  }
  return i
}
