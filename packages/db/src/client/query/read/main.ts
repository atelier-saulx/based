import { QueryDef, QueryDefType } from '../../../index.js'
import { addProp } from './addProps.js'
import { PropDef, PropDefEdge, UINT32 } from '@based/schema/def'
import {
  readInt64,
  readDoubleLE,
  readUint32,
  readInt16,
  readUint16,
  readInt32,
} from '@based/utils'
import {
  INT8,
  INT16,
  INT32,
  UINT8,
  UINT16,
  NUMBER,
  TIMESTAMP,
  BOOLEAN,
  ENUM,
  STRING,
  JSON,
  BINARY,
} from '@based/schema/def'
import { readUtf8 } from '../../string.js'
import { Item } from './types.js'

const readMainValue = (
  q: QueryDef,
  prop: PropDef | PropDefEdge,
  result: Uint8Array,
  i: number,
  item: Item,
) => {
  if (prop.typeIndex === TIMESTAMP) {
    addProp(q, prop, readInt64(result, i), item)
  } else if (prop.typeIndex === NUMBER) {
    addProp(q, prop, readDoubleLE(result, i), item)
  } else if (prop.typeIndex === UINT32) {
    addProp(q, prop, readUint32(result, i), item)
  } else if (prop.typeIndex === BOOLEAN) {
    addProp(q, prop, Boolean(result[i]), item)
  } else if (prop.typeIndex === ENUM) {
    if (result[i] === 0) {
      addProp(q, prop, undefined, item)
    } else {
      addProp(q, prop, prop.enum[result[i] - 1], item)
    }
  } else if (prop.typeIndex === STRING) {
    const len = result[i]
    i++
    const value = len === 0 ? '' : readUtf8(result, i, len)
    addProp(q, prop, value, item)
  } else if (prop.typeIndex === JSON) {
    const len = result[i]
    i++
    const value = len === 0 ? null : global.JSON.parse(readUtf8(result, i, len))
    addProp(q, prop, value, item)
  } else if (prop.typeIndex === BINARY) {
    const len = result[i]
    i++
    const value = len === 0 ? new Uint8Array(0) : result.subarray(i, i + len)
    addProp(q, prop, value, item)
  } else if (prop.typeIndex === INT8) {
    const signedVal = (result[i] << 24) >> 24
    addProp(q, prop, signedVal, item)
  } else if (prop.typeIndex === UINT8) {
    addProp(q, prop, result[i], item)
  } else if (prop.typeIndex === INT16) {
    addProp(q, prop, readInt16(result, i), item)
  } else if (prop.typeIndex === UINT16) {
    addProp(q, prop, readUint16(result, i), item)
  } else if (prop.typeIndex === INT32) {
    addProp(q, prop, readInt32(result, i), item)
  }
}

export const readMain = (
  q: QueryDef,
  result: Uint8Array,
  i: number,
  item: Item,
): number => {
  const mainInclude = q.include.main
  const isEdge = q.type === QueryDefType.Edge
  const main = isEdge ? q.target.ref.reverseMainEdges : q.schema.main
  const len = isEdge ? q.target.ref.edgeMainLen : q.schema.mainLen
  if (mainInclude.len === len) {
    for (const start in main) {
      const prop = main[start]
      readMainValue(q, prop, result, prop.start + i, item)
    }
    i += len
  } else {
    for (const k in mainInclude.include) {
      const [index, prop] = mainInclude.include[k]
      readMainValue(q, prop, result, index + i, item)
    }
    i += mainInclude.len
  }
  return i
}
