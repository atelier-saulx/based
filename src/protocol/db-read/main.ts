import { Meta, ReadMeta, ReadProp, ReadSchema } from './types.js'
import { addMetaProp, addProp } from './addProps.js' // addMetaProp
import {
  readInt64,
  readDoubleLE,
  readUint32,
  readInt16,
  readUint16,
  readInt32,
  readUtf8,
  combineToNumber,
} from '../../utils/index.js'
import { Item } from './types.js'
import { PropType } from '../../zigTsExports.js'
import crc32c from '../../hash/crc32c.js'

export const readMetaMainString = (
  result: Uint8Array,
  i: number,
  len: number,
): Meta => {
  const crc32 = crc32c(result.subarray(i, i + len))
  const checksum = combineToNumber(crc32, len)
  return {
    checksum,
    size: len,
    crc32,
    compressed: false,
    compressedSize: len,
  }
}

const readMainValue = (
  prop: ReadProp,
  result: Uint8Array,
  i: number,
  item: Item,
) => {
  const typeIndex = prop.type

  if (typeIndex === PropType.timestamp) {
    addProp(prop, readInt64(result, i), item)
  } else if (typeIndex === PropType.number) {
    addProp(prop, readDoubleLE(result, i), item)
  } else if (typeIndex === PropType.uint32) {
    addProp(prop, readUint32(result, i), item)
  } else if (typeIndex === PropType.boolean) {
    addProp(prop, Boolean(result[i]), item)
  } else if (typeIndex === PropType.enum) {
    if (result[i] === 0) {
      addProp(prop, null, item)
    } else {
      addProp(prop, prop.enum![result[i] - 1], item)
    }
  } else if (typeIndex === PropType.stringFixed) {
    const len = result[i]
    i++
    const value = len === 0 ? '' : readUtf8(result, i, len)
    if (prop.meta === ReadMeta.only) {
      addMetaProp(prop, readMetaMainString(result, i, len), item)
    } else if (prop.meta === ReadMeta.combined) {
      addMetaProp(prop, readMetaMainString(result, i, len), item)
      addProp(prop, value, item)
    } else {
      addProp(prop, value, item)
    }
  } else if (typeIndex === PropType.json || typeIndex === PropType.jsonFixed) {
    const len = result[i]
    i++
    const value = len === 0 ? null : global.JSON.parse(readUtf8(result, i, len))
    addProp(prop, value, item)
  } else if (
    typeIndex === PropType.binary ||
    typeIndex === PropType.binaryFixed
  ) {
    const len = result[i]
    i++
    const value = len === 0 ? new Uint8Array(0) : result.subarray(i, i + len)
    addProp(prop, value, item)
  } else if (typeIndex === PropType.int8) {
    const signedVal = (result[i] << 24) >> 24
    addProp(prop, signedVal, item)
  } else if (typeIndex === PropType.uint8) {
    addProp(prop, result[i], item)
  } else if (typeIndex === PropType.int16) {
    addProp(prop, readInt16(result, i), item)
  } else if (typeIndex === PropType.uint16) {
    addProp(prop, readUint16(result, i), item)
  } else if (typeIndex === PropType.int32) {
    addProp(prop, readInt32(result, i), item)
  }
}

export const readMain = (
  q: ReadSchema,
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
