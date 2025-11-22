import { ReaderMeta, ReaderPropDef, ReaderSchema } from './types.js'
import { addMetaProp, addProp } from './addProps.js'
import {
  readInt64,
  readDoubleLE,
  readUint32,
  readInt16,
  readUint16,
  readInt32,
  readUtf8,
} from '@based/utils'
import { Item } from './types.js'
import { readMetaMainString } from './meta.js'
import { typeIndexMap } from '@based/schema'

const readMainValue = (
  prop: ReaderPropDef,
  result: Uint8Array,
  i: number,
  item: Item,
) => {
  const typeIndex = prop.typeIndex
  if (typeIndex === typeIndexMap.timestamp) {
    addProp(prop, readInt64(result, i), item)
  } else if (typeIndex === typeIndexMap.number) {
    addProp(prop, readDoubleLE(result, i), item)
  } else if (typeIndex === typeIndexMap.uint32) {
    addProp(prop, readUint32(result, i), item)
  } else if (typeIndex === typeIndexMap.boolean) {
    addProp(prop, Boolean(result[i]), item)
  } else if (typeIndex === typeIndexMap.enum) {
    if (result[i] === 0) {
      addProp(prop, undefined, item)
    } else {
      addProp(prop, prop.enum[result[i] - 1], item)
    }
  } else if (typeIndex === typeIndexMap.string) {
    const len = result[i]
    i++
    const value = len === 0 ? '' : readUtf8(result, i, len)
    if (prop.meta) {
      if (prop.meta === ReaderMeta.combined) {
        addMetaProp(prop, readMetaMainString(result, i, len), item)
        addProp(prop, value, item)
      } else {
        addMetaProp(prop, readMetaMainString(result, i, len), item)
      }
    } else {
      addProp(prop, value, item)
    }
  } else if (typeIndex === typeIndexMap.json) {
    const len = result[i]
    i++
    const value = len === 0 ? null : global.JSON.parse(readUtf8(result, i, len))
    addProp(prop, value, item)
  } else if (typeIndex === typeIndexMap.binary) {
    const len = result[i]
    i++
    const value = len === 0 ? new Uint8Array(0) : result.subarray(i, i + len)
    addProp(prop, value, item)
  } else if (typeIndex === typeIndexMap.int8) {
    const signedVal = (result[i] << 24) >> 24
    addProp(prop, signedVal, item)
  } else if (typeIndex === typeIndexMap.uint8) {
    addProp(prop, result[i], item)
  } else if (typeIndex === typeIndexMap.int16) {
    addProp(prop, readInt16(result, i), item)
  } else if (typeIndex === typeIndexMap.uint16) {
    addProp(prop, readUint16(result, i), item)
  } else if (typeIndex === typeIndexMap.int32) {
    addProp(prop, readInt32(result, i), item)
  }
}

export const readMain = (
  q: ReaderSchema,
  result: Uint8Array,
  i: number,
  item: Item,
): number => {
  const mainInclude = q.main
  for (const k in mainInclude.props) {
    const prop = mainInclude.props[k]
    readMainValue(prop, result, Number(k) + i, item)
  }
  i += mainInclude.len
  return i
}
