import {
  ALIAS,
  ALIASES,
  BINARY,
  BOOLEAN,
  ENUM,
  INT16,
  INT32,
  INT8,
  NUMBER,
  PropDef,
  PropDefEdge,
  STRING,
  TEXT,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
} from '../../../server/schema/types.js'
import { QueryDef } from '../types.js'
import { read, readUtf8 } from '../../string.js'
import {
  readDoubleLE,
  readInt16,
  readInt32,
  readUint16,
  readUint32,
} from '../../bitWise.js'
import { inverseLangMap } from '@based/schema'

export type Item = {
  id: number
} & { [key: string]: any }

const addField = (
  p: PropDef | PropDefEdge,
  value: any,
  item: Item,
  defaultOnly: boolean = false,
  lang: number = 0,
) => {
  let i = p.__isEdge === true ? 1 : 0

  // TODO OPTMIZE
  const path = lang ? [...p.path, inverseLangMap.get(lang)] : p.path
  const len = path.length

  if (len - i === 1) {
    const field = path[i]
    if (!defaultOnly || !(field in item)) {
      item[field] = value
    }
  } else {
    let select: any = item
    for (; i < len; i++) {
      const field = path[i]
      if (i === len - 1) {
        if (!defaultOnly || !(field in select)) {
          select[field] = value
        }
      } else {
        select = select[field] ?? (select[field] = {})
      }
    }
  }
}

const readMainValue = (
  prop: PropDef | PropDefEdge,
  result: Uint8Array,
  index: number,
  item: Item,
) => {
  // 1: timestamp, 4: number
  if (prop.typeIndex === TIMESTAMP || prop.typeIndex === NUMBER) {
    addField(prop, readDoubleLE(result, index), item)
  }
  // 5: uint32
  else if (prop.typeIndex === UINT32) {
    addField(prop, readUint32(result, index), item)
  }
  // 9: boolean
  else if (prop.typeIndex === BOOLEAN) {
    addField(prop, Boolean(result[index]), item)
  }
  // 10: Enum
  else if (prop.typeIndex === ENUM) {
    if (result[index] === 0) {
      addField(prop, undefined, item)
    } else {
      addField(prop, prop.enum[result[index] - 1], item)
    }
  }
  // 11: string
  else if (prop.typeIndex === STRING) {
    // Also remove this default then (same as other string)
    const len = result[index]
    if (len !== 0) {
      const str = readUtf8(result, index + 1, len)
      addField(prop, str, item)
    } else {
      addField(prop, '', item)
    }
  }
  // 25: binary
  else if (prop.typeIndex === BINARY) {
    addField(prop, result.subarray(index + 1, index + 1 + result[index]), item)
  }
  // 18: int8
  else if (prop.typeIndex === INT8) {
    const signedVal = (result[index] << 24) >> 24
    addField(prop, signedVal, item)
  }
  // 19: uint8
  else if (prop.typeIndex === UINT8) {
    addField(prop, result[index], item)
  }
  // 20: int16
  else if (prop.typeIndex === INT16) {
    addField(prop, readInt16(result, index), item)
  }
  // 21: uint16
  else if (prop.typeIndex === UINT16) {
    addField(prop, readUint16(result, index), item)
  }
  // 22: int32
  else if (prop.typeIndex === INT32) {
    addField(prop, readInt32(result, index), item)
  }
}

const readMain = (
  q: QueryDef,
  result: Uint8Array,
  offset: number,
  item: Item,
) => {
  const mainInclude = q.include.main
  let i = offset
  if (mainInclude.len === q.schema.mainLen) {
    for (const start in q.schema.main) {
      readMainValue(q.schema.main[start], result, Number(start) + i, item)
    }
    i += q.schema.mainLen
  } else {
    for (const k in mainInclude.include) {
      const [index, prop] = mainInclude.include[k]
      readMainValue(prop, result, index + i, item)
    }
    i += mainInclude.len
  }
  return i - offset
}

const handleUndefinedProps = (id: number, q: QueryDef, item: Item) => {
  for (const k in q.include.propsRead) {
    if (q.include.propsRead[k] !== id) {
      addField(q.schema.reverseProps[k], '', item)
    }
  }
}

export const readAllFields = (
  q: QueryDef,
  result: Uint8Array,
  offset: number,
  end: number,
  item: Item,
  id: number,
): number => {
  let i = offset
  while (i < end) {
    const index = result[i]
    i++
    if (index === 255) {
      handleUndefinedProps(id, q, item)
      return i - offset
    }
    if (index === 252) {
      let prop = result[i]
      if (prop === 254) {
        i++
        const field = result[i]
        i++
        const size = readUint32(result, i)
        i += 4
        const ref = q.edges.references.get(field)
        if (size === 0) {
          // @ts-ignore
          addField(ref.target.propDef, null, item)
          i += size
        } else {
          i++
          const id = readUint32(result, i)
          i += 4
          const refItem: Item = {
            id,
          }
          readAllFields(ref, result, i, size + i - 5, refItem, id)
          // @ts-ignore
          addField(ref.target.propDef, refItem, item)
          i += size - 5
        }
      } else if (prop === 253) {
        i++
        const field = result[i]
        i++
        const ref = q.edges.references.get(field)
        const size = readUint32(result, i)
        i += 4
        const refs = resultToObject(ref, result, size + i + 4, i)
        // @ts-ignore
        addField(ref.target.propDef, refs, item)
        i += size + 4
        // ----------------
      } else {
        const edgeDef = q.edges.reverseProps[prop]
        const t = edgeDef.typeIndex
        if (t === BINARY) {
          i++
          const size = readUint32(result, i)
          addField(edgeDef, result.subarray(i + 6, size + i), item)
          i += size + 4
        } else if (t === STRING || t === ALIAS || t === ALIASES) {
          i++
          const size = readUint32(result, i)
          if (size === 0) {
            addField(edgeDef, '', item)
          } else {
            addField(edgeDef, read(result, i + 4, size), item)
          }
          i += size + 4
        } else {
          i++
          readMainValue(edgeDef, result, i, item)
          i += edgeDef.len
        }
      }
    } else if (index === 254) {
      const field = result[i]
      i++
      const size = readUint32(result, i)
      i += 4
      const ref = q.references.get(field)
      if (size === 0) {
        // @ts-ignore
        addField(ref.target.propDef, null, item)
        i += size
      } else {
        i++
        let id = readUint32(result, i)
        i += 4
        const refItem: Item = {
          id,
        }
        readAllFields(ref, result, i, size + i - 5, refItem, id)
        // @ts-ignore
        addField(ref.target.propDef, refItem, item)
        i += size - 5
      }
    } else if (index === 253) {
      const field = result[i]
      i++
      const ref = q.references.get(field)
      const size = readUint32(result, i)
      i += 4
      const refs = resultToObject(ref, result, size + i + 4, i)
      // @ts-ignore
      addField(ref.target.propDef, refs, item)
      i += size + 4
    } else if (index === 0) {
      i += readMain(q, result, i, item)
    } else {
      const prop = q.schema.reverseProps[index]
      if (prop.typeIndex === BINARY) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        addField(prop, result.subarray(i + 6, i + size), item)
        i += size + 4
      } else if (prop.typeIndex === STRING) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        if (size === 0) {
          addField(prop, '', item)
        } else {
          addField(prop, read(result, i + 4, size), item)
        }
        i += size + 4
      } else if (prop.typeIndex == TEXT) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)

        // if queryDef.LANG do different

        if (size === 0) {
          // LATER
          // addField(prop, '', item)
        } else {
          addField(prop, read(result, i + 4, size), item, false, result[i + 4])
        }

        const lan =
          // TODO Read text
          //if (size === 0) {
          //  addField(prop, '', item)
          //} else {
          //  addField(prop, read(result, i + 4, size), item)
          //}
          (i += size + 4)
      } else if (prop.typeIndex === ALIAS) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        i += 4
        if (size === 0) {
          addField(prop, '', item)
        } else {
          const string = readUtf8(result, i, size)
          i += size
          addField(prop, string, item)
        }
      }
    }
  }
  // to add defaults - may not optimal for performance
  handleUndefinedProps(id, q, item)
  return i - offset
}

export const resultToObject = (
  q: QueryDef,
  result: Uint8Array,
  end: number,
  offset: number = 0,
) => {
  const len = readUint32(result, offset)
  if (len === 0) {
    return []
  }
  let items = []
  let i = 5 + offset
  while (i < end) {
    const id = readUint32(result, i)
    i += 4
    const item: Item = {
      id,
    }
    if (q.search) {
      item.$searchScore = result[i]
      i += 1
    }
    const l = readAllFields(q, result, i, end, item, id)
    i += l
    items.push(item)
  }
  if ('id' in q.target || 'alias' in q.target) {
    return items[0]
  }
  return items
}
