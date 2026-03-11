import { readUint32, readUtf8 } from '../../utils/index.js'
import { Item, ReaderMeta, ReadProp, ReadSchema } from './types.js'
import { addProp, addLangProp } from './addProps.js'
import { readString } from './string.js'
import { readVector } from './vector.js'
import { PropType } from '../../zigTsExports.js'
import { VECTOR_BASE_TYPE_SIZE_MAP } from '../../schema/defs/props/vector.js'

const readStringProp = (
  prop: ReadProp,
  buf: Uint8Array,
  offset: number,
  size: number,
) => {
  if (
    prop.type === PropType.stringLocalized ||
    prop.type === PropType.string ||
    prop.type === PropType.alias
  ) {
    return readString(buf, offset, size, true)
  }
  if (prop.type === PropType.json || prop.type === PropType.jsonLocalized) {
    return global.JSON.parse(readString(buf, offset, size, true))
  }
  if (prop.type === PropType.binary) {
    return buf.subarray(offset + 2, size + offset)
  }
}

export const readProp = (
  instruction: number,
  q: ReadSchema,
  result: Uint8Array,
  i: number,
  item: Item,
) => {
  const prop = q.props[instruction]
  prop.readBy = q.readId
  if (prop.type === PropType.cardinality) {
    const size = readUint32(result, i)
    addProp(prop, readUint32(result, i + 4), item)
    i += size + 4
  } else if (prop.type === PropType.json) {
    const size = readUint32(result, i)
    addProp(prop, readStringProp(prop, result, i + 4, size), item)
    i += size + 4
  } else if (prop.type === PropType.binary) {
    const size = readUint32(result, i)
    addProp(prop, readStringProp(prop, result, i + 4, size), item)
    i += size + 4
  } else if (prop.type === PropType.string) {
    const size = readUint32(result, i)
    addProp(prop, readStringProp(prop, result, i + 4, size), item)
    i += size + 4
  } else if (
    prop.type == PropType.stringLocalized ||
    prop.type === PropType.jsonLocalized
  ) {
    const size = readUint32(result, i)
    if (size === 0) {
      // do nothing
    } else {
      if (!prop.locales) {
        addProp(prop, readString(result, i + 4, size, true), item)
      } else {
        addLangProp(
          prop,
          readStringProp(prop, result, i + 4, size),
          item,
          result[i + 4],
        )
      }
    }
    i += size + 4
  } else if (prop.type === PropType.alias) {
    const size = readUint32(result, i)
    i += 4
    if (size === 0) {
      addProp(prop, '', item)
    } else {
      const string = readUtf8(result, i, size)
      i += size
      addProp(prop, string, item)
    }
  } else if (prop.type === PropType.vector || prop.type === PropType.colVec) {
    const vecSize = prop.len! * VECTOR_BASE_TYPE_SIZE_MAP[prop.vectorBaseType!]
    const tmp = result.slice(i, i + vecSize) // maybe align?
    addProp(prop, readVector(prop, tmp), item)
    i += vecSize
  }
  return i
}
