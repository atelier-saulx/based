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
  PropDefAggregate,
  STRING,
  TEXT,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
  VECTOR,
  JSON,
  CARDINALITY,
} from '@based/schema/def'
import { QueryDef, QueryDefType } from '../types.js'
import { read, readUtf8 } from '../../string.js'
import {
  readDoubleLE,
  readFloatLE,
  readInt16,
  readInt32,
  readUint16,
  readUint32,
} from '../../../utils.js'
import { inverseLangMap } from '@based/schema'
import {
  READ_EDGE,
  READ_ID,
  READ_REFERENCE,
  READ_REFERENCES,
  READ_AGGREGATION,
  CREATE_AGGREGATION,
  AggFn,
} from '../types.js'

export type Item = {
  id: number
} & { [key: string]: any }

export type AggItem = Partial<Item>

const addField = (
  p: PropDef | PropDefEdge | PropDefAggregate,
  value: any,
  item: Item | AggItem,
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

const getEmptyField = (p: PropDef | PropDefEdge, item: Item | AggItem) => {
  let i = p.__isEdge === true ? 1 : 0
  const path = p.path
  const len = path.length
  let select: any = item
  if (len - i === 1) {
    const field = path[i]
    if (!(field in item)) {
      select = item[field] = {}
    } else {
      return item[field]
    }
  } else {
    for (; i < len; i++) {
      const field = path[i]
      if (i === len - 1) {
        if (!(field in select)) {
          select = select[field] = {}
        }
      } else {
        select = select[field] ?? (select[field] = {})
      }
    }
  }
  return select
}

const readMainValue = (
  prop: PropDef | PropDefEdge,
  result: Uint8Array,
  index: number,
  item: Item | AggItem,
) => {
  if (prop.typeIndex === TIMESTAMP || prop.typeIndex === NUMBER) {
    addField(prop, readDoubleLE(result, index), item)
  } else if (prop.typeIndex === UINT32) {
    addField(prop, readUint32(result, index), item)
  } else if (prop.typeIndex === BOOLEAN) {
    addField(prop, Boolean(result[index]), item)
  } else if (prop.typeIndex === ENUM) {
    if (result[index] === 0) {
      addField(prop, undefined, item)
    } else {
      addField(prop, prop.enum[result[index] - 1], item)
    }
  } else if (prop.typeIndex === STRING) {
    const len = result[index]
    if (len !== 0) {
      const str = readUtf8(result, index + 1, len)
      addField(prop, str, item)
    } else {
      addField(prop, '', item)
    }
  } else if (prop.typeIndex === JSON) {
    addField(
      prop,
      global.JSON.parse(readUtf8(result, index + 1, index + 1 + result[index])),
      item,
    )
  } else if (prop.typeIndex === BINARY) {
    addField(prop, result.subarray(index + 1, index + 1 + result[index]), item)
  } else if (prop.typeIndex === INT8) {
    const signedVal = (result[index] << 24) >> 24
    addField(prop, signedVal, item)
  } else if (prop.typeIndex === UINT8) {
    addField(prop, result[index], item)
  } else if (prop.typeIndex === INT16) {
    addField(prop, readInt16(result, index), item)
  } else if (prop.typeIndex === UINT16) {
    addField(prop, readUint16(result, index), item)
  } else if (prop.typeIndex === INT32) {
    addField(prop, readInt32(result, index), item)
  }
}

const readMain = (
  q: QueryDef,
  result: Uint8Array,
  offset: number,
  item: Item | AggItem,
) => {
  const mainInclude = q.include.main
  let i = offset

  const isEdge = q.type === QueryDefType.Edge

  const main = isEdge ? q.target.ref.reverseMainEdges : q.schema.main

  const len = isEdge ? q.target.ref.edgeMainLen : q.schema.mainLen

  if (mainInclude.len === len) {
    for (const start in main) {
      readMainValue(main[start], result, Number(start) + i, item)
    }
    i += len
  } else {
    for (const k in mainInclude.include) {
      const [index, prop] = mainInclude.include[k]
      readMainValue(prop, result, index + i, item)
    }
    i += mainInclude.len
  }
  return i - offset
}

const handleUndefinedProps = (
  id: number,
  q: QueryDef,
  item: Item | AggItem,
) => {
  if (q.aggregation != AggFn.NONE) {
    for (const k in q.include.propsRead) {
      if (q.include.propsRead[k] !== id) {
        // Only relvant for seperate props
        const prop = q.schema.reverseProps[k]
        if (prop.typeIndex === CARDINALITY) {
          addField(prop, 0, item)
        } else if (prop.typeIndex === TEXT && q.lang == 0) {
          const lan = getEmptyField(prop, item)
          const lang = q.include.langTextFields.get(prop.prop).codes
          if (lang.has(0)) {
            for (const locale in q.schema.locales) {
              if (!lan[locale]) {
                lan[locale] = ''
              }
            }
          } else {
            for (const code of lang) {
              const locale = inverseLangMap.get(code)
              if (!lan[locale]) {
                lan[locale] = ''
              }
            }
          }
        } else {
          addField(prop, prop.typeIndex === JSON ? null : '', item)
        }
      }
    }
  }
}

export const readAllFields = (
  q: QueryDef,
  result: Uint8Array,
  offset: number,
  end: number,
  item: Item | AggItem,
  id: number,
): number => {
  let i = offset
  while (i < end) {
    const index = result[i]
    i++
    if (index === READ_ID) {
      handleUndefinedProps(id, q, item)
      return i - offset
    }
    if (index === READ_EDGE) {
      let prop = result[i]
      if (prop === READ_REFERENCE) {
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
      } else if (prop === READ_REFERENCES) {
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
        i++
        const target = 'ref' in q.edges.target && q.edges.target.ref
        if (prop === 0) {
          i += readMain(q.edges, result, i, item)
          // i += edgeDef.len
        } else {
          const edgeDef: PropDefEdge = target.reverseSeperateEdges[prop]
          const t = edgeDef.typeIndex
          if (t === JSON) {
            const size = readUint32(result, i)
            addField(
              edgeDef,
              global.JSON.parse(readUtf8(result, i + 6, size + i)),
              item,
            )
            i += size + 4
          } else if (t === BINARY) {
            const size = readUint32(result, i)
            addField(edgeDef, result.subarray(i + 6, size + i), item)
            i += size + 4
          } else if (t === STRING || t === ALIAS || t === ALIASES) {
            const size = readUint32(result, i)
            if (size === 0) {
              addField(edgeDef, '', item)
            } else {
              addField(edgeDef, read(result, i + 4, size), item)
            }
            i += size + 4
          } else if (t === CARDINALITY) {
            const size = readUint32(result, i)
            addField(edgeDef, readUint32(result, i + 4), item)
            i += size + 4
          }
        }
      }
    } else if (index === READ_REFERENCE) {
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
    } else if (index === READ_REFERENCES) {
      const field = result[i]
      i++
      const ref = q.references.get(field)
      const size = readUint32(result, i)
      i += 4
      const refs = resultToObject(ref, result, size + i + 4, i)
      // @ts-ignore
      addField(ref.target.propDef, refs, item)
      i += size + 4
    } else if (index === CREATE_AGGREGATION) {
      i--
      result[i] = READ_AGGREGATION
      q.aggregation = AggFn.NONE
      return i - offset - 4 - (q.search ? 4 : 0)
    } else if (index === READ_AGGREGATION) {
      // TODO: To change to a map and also to get the aggregate field name from a query function parameter
      const propAgg: PropDefAggregate = {
        name: 'count',
        path: ['count'],
        typeIndex: UINT32,
      } as PropDefAggregate
      const size = readUint32(result, i)
      addField(propAgg, readUint32(result, i + 4), item)
      i += 4 + size + 4
    } else if (index === 0) {
      i += readMain(q, result, i, item)
    } else {
      const prop = q.schema.reverseProps[index]
      if (prop.typeIndex === CARDINALITY) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        addField(prop, readUint32(result, i + 4), item)
        i += size + 4
      } else if (prop.typeIndex === JSON) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        addField(
          prop,
          global.JSON.parse(readUtf8(result, i + 6, size - 6)),
          item,
        )
        i += size + 4
      } else if (prop.typeIndex === BINARY) {
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
        const size = readUint32(result, i)
        if (size === 0) {
        } else {
          if (q.lang != 0) {
            q.include.propsRead[index] = id
            addField(prop, read(result, i + 4, size), item)
          } else {
            addField(
              prop,
              read(result, i + 4, size),
              item,
              false,
              result[i + 4],
            )
          }
        }
        i += size + 4
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
      } else if (prop.typeIndex == VECTOR) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        const arr = new Float32Array(size / 4)
        for (let j = 0; j < size; j += 4) {
          arr[j / 4] = readFloatLE(result, i + 4 + j)
        }
        addField(prop, arr, item)
        i += size + 4
      }
    }
  }
  handleUndefinedProps(id, q, item)
  return i - offset
}

let cnt = 0
export const resultToObject = (
  q: QueryDef,
  result: Uint8Array,
  end: number,
  offset: number = 0,
) => {
  const len = readUint32(result, offset)

  if (len === 0) {
    if ('id' in q.target || 'alias' in q.target) {
      return null
    }
    return []
  }
  let items = []
  let i = 5 + offset

  while (i < end) {
    const id = readUint32(result, i)
    i += 4
    let item: AggItem
    if (q.aggregation == AggFn.NONE) {
      item = {}
    } else {
      item = {
        id,
      }
    }

    if (q.search) {
      item.$searchScore = readFloatLE(result, i)
      i += 4
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
