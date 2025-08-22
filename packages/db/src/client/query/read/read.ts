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
  VECTOR,
  JSON,
  CARDINALITY,
  COLVEC,
  isNumberType,
  TypeIndex,
  REFERENCE,
} from '@based/schema/def'
import { MainMetaInclude, QueryDef, QueryDefType, READ_META } from '../types.js'
import { read, readUtf8 } from '../../string.js'
import {
  combineToNumber,
  DECODER,
  getByPath,
  readDoubleLE,
  readFloatLE,
  readInt16,
  readInt32,
  readInt64,
  readUint16,
  readUint32,
  setByPath,
} from '@based/utils'
import { inverseLangMap } from '@based/schema'
import {
  READ_EDGE,
  READ_ID,
  READ_REFERENCE,
  READ_REFERENCES,
  READ_AGGREGATION,
} from '../types.js'
import { AggregateType } from '../aggregates/types.js'
import { crc32c } from '@based/hash'

export type Item = {
  id: number
} & { [key: string]: any }

const readAggregate = (
  q: QueryDef,
  result: Uint8Array,
  offset: number,
  len: number,
) => {
  const results = {}
  if (q.aggregate.groupBy) {
    let i = offset
    while (i < len) {
      let key: string = ''
      let keyLen: number = 0
      if (result[i] == 0) {
        if (q.aggregate.groupBy.default) {
          key = q.aggregate.groupBy.default
        } else {
          key = `$undefined`
        }
        i += 2
      } else {
        if (q.aggregate.groupBy.typeIndex == ENUM) {
          i += 2
          key = q.aggregate.groupBy.enum[result[i] - 1]
          i++
        } else if (isNumberType(q.aggregate.groupBy.typeIndex)) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, q.aggregate.groupBy.typeIndex)
          i += keyLen
        } else if (
          q.aggregate.groupBy.typeIndex == TIMESTAMP &&
          q.aggregate.groupBy.stepType
        ) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, INT32)
          i += keyLen
        } else if (
          q.aggregate.groupBy.typeIndex == TIMESTAMP &&
          q.aggregate.groupBy.stepRange !== 0
        ) {
          keyLen = readUint16(result, i)
          i += 2
          if (!q.aggregate?.groupBy?.display) {
            key = readInt64(result, i).toString()
          } else if (q.aggregate?.groupBy?.stepRange > 0) {
            const dtFormat = q.aggregate?.groupBy.display
            let v = readInt64(result, i)
            key = dtFormat.formatRange(
              v,
              v + q.aggregate?.groupBy.stepRange * 1000,
            )
          } else {
            const dtFormat = q.aggregate?.groupBy.display
            key = dtFormat.format(readInt64(result, i))
          }

          i += keyLen
        } else if (q.aggregate.groupBy.typeIndex == REFERENCE) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, INT32)
          i += keyLen
        } else {
          keyLen = readUint16(result, i)
          i += 2
          key = DECODER.decode(result.subarray(i, i + keyLen))
          i += keyLen
        }
      }
      const resultKey = (results[key] = {})
      for (const aggregatesArray of q.aggregate.aggregates.values()) {
        for (const agg of aggregatesArray) {
          var val = undefined
          if (
            agg.type === AggregateType.CARDINALITY ||
            agg.type === AggregateType.COUNT
          ) {
            val = readUint32(result, agg.resultPos + i)
          } else {
            val = readDoubleLE(result, agg.resultPos + i)
          }
          setByPath(resultKey, agg.propDef.path, val)
        }
      }
      i += q.aggregate.totalResultsSize
    }
  } else {
    for (const aggregatesArray of q.aggregate.aggregates.values()) {
      for (const agg of aggregatesArray) {
        var val = undefined
        if (
          agg.type === AggregateType.CARDINALITY ||
          agg.type === AggregateType.COUNT
        ) {
          val = readUint32(result, agg.resultPos + offset)
        } else {
          val = readDoubleLE(result, agg.resultPos + offset)
        }
        setByPath(results, agg.propDef.path, val)
      }
    }
  }
  return results
}

const addField = (
  p: PropDef | PropDefEdge,
  value: any,
  item: Item,
  merge: boolean,
  defaultOnly: boolean = false,
  lang: number = 0,
  lastField: string | false = false,
) => {
  if (p.transform) {
    value = p.transform('read', value)
  }

  let i = p.__isEdge === true ? 1 : 0
  // TODO OPTMIZE
  const path = lastField
    ? [...p.path, lastField]
    : lang
      ? [...p.path, inverseLangMap.get(lang)]
      : p.path
  const len = path.length
  if (len - i === 1) {
    const field = path[i]
    if (!defaultOnly || !(field in item)) {
      if (item[field] && merge) {
        item[field] = { ...item[field], ...value }
      } else {
        item[field] = value
      }
    }
  } else {
    let select: any = item
    for (; i < len; i++) {
      const field = path[i]
      if (i === len - 1) {
        if (!defaultOnly || !(field in select)) {
          if (select[field] && merge) {
            select[field] = { ...select[field], ...value }
          } else {
            select[field] = value
          }
        }
      } else {
        select = select[field] ?? (select[field] = {})
      }
    }
  }
}

const getEmptyField = (p: PropDef | PropDefEdge, item: Item) => {
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
      select = select[field] ?? (select[field] = {})
    }
  }
  return select
}

export type AggItem = Partial<Item>

const readMainValue = (
  q: QueryDef,
  prop: PropDef | PropDefEdge,
  result: Uint8Array,
  index: number,
  item: Item,
) => {
  if (prop.typeIndex === TIMESTAMP) {
    addField(prop, readInt64(result, index), item, false)
  } else if (prop.typeIndex === NUMBER) {
    addField(prop, readDoubleLE(result, index), item, false)
  } else if (prop.typeIndex === UINT32) {
    addField(prop, readUint32(result, index), item, false)
  } else if (prop.typeIndex === BOOLEAN) {
    addField(prop, Boolean(result[index]), item, false)
  } else if (prop.typeIndex === ENUM) {
    if (result[index] === 0) {
      addField(prop, undefined, item, false)
    } else {
      addField(prop, prop.enum[result[index] - 1], item, false)
    }
  } else if (
    prop.typeIndex === STRING ||
    prop.typeIndex === JSON ||
    prop.typeIndex === BINARY
  ) {
    readMainStringType(q, prop, result, index, item)
  } else if (prop.typeIndex === INT8) {
    const signedVal = (result[index] << 24) >> 24
    addField(prop, signedVal, item, false)
  } else if (prop.typeIndex === UINT8) {
    addField(prop, result[index], item, false)
  } else if (prop.typeIndex === INT16) {
    addField(prop, readInt16(result, index), item, false)
  } else if (prop.typeIndex === UINT16) {
    addField(prop, readUint16(result, index), item, false)
  } else if (prop.typeIndex === INT32) {
    addField(prop, readInt32(result, index), item, false)
  }
}

const getDefaultSelvaStringValue = (prop: PropDef | PropDefEdge) => {
  if (
    prop.typeIndex === TEXT ||
    prop.typeIndex === STRING ||
    prop.typeIndex === ALIAS
  ) {
    return ''
  }
  if (prop.typeIndex === JSON) {
    return null
  }
  if (prop.typeIndex === BINARY) {
    return new Uint8Array()
  }
}

type MetaSelvaString = {
  checksum: number
  size: number
  crc32: number
  compressed: boolean
  value?: any
}

const EMPTY_META: MetaSelvaString = {
  checksum: 0,
  size: 0,
  crc32: 0,
  compressed: false,
}

const readMetaSelvaString = (
  result: Uint8Array,
  i: number,
): MetaSelvaString => {
  const crc32 = readUint32(result, i + 1)
  const size = readUint32(result, i + 5) - 6
  const checksum = combineToNumber(crc32, size)
  const compressed = result[i] === 1
  return { checksum, size, crc32, compressed }
}

const readMetaMainString = (
  result: Uint8Array,
  i: number,
  len: number,
): MetaSelvaString => {
  const crc32 = crc32c(result.subarray(i, i + len))
  const checksum = combineToNumber(crc32, len)
  return { checksum, size: len, crc32, compressed: false }
}

const readMainStringType = (
  q: QueryDef,
  prop: PropDef | PropDefEdge,
  result: Uint8Array,
  index: number,
  item: Item,
) => {
  const len = result[index]
  const hasChecksum = q.include.metaMain?.has(prop.start)
  index = index + 1
  let value: any
  if (len === 0) {
    if (prop.typeIndex === STRING) {
      value = ''
    } else if (prop.typeIndex === JSON) {
      value = null
    } else if (prop.typeIndex === BINARY) {
      value = new Uint8Array()
    }
    if (hasChecksum) {
      if (q.include.metaMain?.get(prop.start) === MainMetaInclude.MetaOnly) {
        addField(prop, { ...EMPTY_META }, item, false)
      } else {
        addField(prop, { ...EMPTY_META, value }, item, false)
      }
    } else {
      addField(prop, value, item, false)
    }
  } else {
    if (prop.typeIndex === STRING) {
      value = readUtf8(result, index, len)
    } else if (prop.typeIndex === JSON) {
      value = global.JSON.parse(readUtf8(result, index, len))
    } else if (prop.typeIndex === BINARY) {
      value = result.subarray(index, index + len)
    }
    if (hasChecksum) {
      const meta = readMetaMainString(result, index, len)
      if (q.include.metaMain?.get(prop.start) === MainMetaInclude.MetaOnly) {
        addField(prop, meta, item, false)
      } else {
        meta.value = value
        addField(prop, meta, item, false)
      }
    } else {
      addField(prop, value, item, false)
    }
  }
}

const readSelvaStringValue = (
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

const selvaStringProp = (
  q: QueryDef,
  prop: PropDef | PropDefEdge,
  item: Item,
  buf?: Uint8Array,
  offset: number = 0,
  size: number = 0,
) => {
  const useDefault = !buf || size === 0
  const value = useDefault
    ? getDefaultSelvaStringValue(prop)
    : readSelvaStringValue(prop, buf, offset, size)
  const checksum = q.include.meta?.has(prop.prop)
  if (checksum) {
    addField(prop, value, item, false, false, 0, 'value')
    if (useDefault) {
      addField(prop, EMPTY_META, item, true)
    }
  } else {
    addField(prop, value, item, false)
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
  return i - offset
}

const handleUndefinedProps = (id: number, q: QueryDef, item: Item) => {
  // can be optmized a lot... shit meta info in the propsRead objectmeta is just a shift of 8
  if (q.include.meta) {
    for (const k of q.include.meta) {
      const prop = q.schema.reverseProps[k]
      if (
        q.include.propsRead[k] !== id &&
        getByPath(item, prop.path) === undefined
      ) {
        addField(prop, { ...EMPTY_META }, item, true)
      }
    }
  }

  for (const k in q.include.propsRead) {
    if (q.include.propsRead[k] !== id) {
      // Only relevant for seperate props
      const prop = q.schema.reverseProps[k]
      if (prop.typeIndex === CARDINALITY) {
        addField(prop, 0, item, false)
      } else if (prop.typeIndex === TEXT && q.lang.lang == 0) {
        const lan = getEmptyField(prop, item)
        const lang = q.include.langTextFields.get(prop.prop).codes
        if (lang.has(0)) {
          for (const locale in q.schema.locales) {
            if (lan[locale] == undefined) {
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
        selvaStringProp(q, prop, item)
      }
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

    if (index === READ_ID) {
      handleUndefinedProps(id, q, item)
      return i - offset
    }

    if (index === READ_META) {
      const field = result[i]
      i++
      const prop = q.schema.reverseProps[field]
      addField(prop, readMetaSelvaString(result, i), item, true)
      i += 9
    } else if (index === READ_AGGREGATION) {
      // also for edges at some point!
      let field = result[i]
      i++
      const size = readUint32(result, i)
      i += 4
      const ref = q.references.get(field)
      addField(
        // @ts-ignore
        ref.target.propDef,
        readAggregate(ref, result, i, i + size),
        item,
        false,
      )
      i += size
    } else if (index === READ_EDGE) {
      let prop = result[i]
      if (prop === READ_META) {
        i++
        const target = 'ref' in q.edges.target && q.edges.target.ref
        prop = result[i]
        i++
        const propDef = target.reverseSeperateEdges[prop]
        addField(propDef, readMetaSelvaString(result, i), item, true)
        i += 9
      } else if (prop === READ_REFERENCE) {
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
            selvaStringProp(q, edgeDef, item, result, i + 4, size)
            i += size + 4
          } else if (t === BINARY) {
            const size = readUint32(result, i)
            selvaStringProp(q, edgeDef, item, result, i + 4, size)
            i += size + 4
          } else if (t === STRING || t === ALIAS || t === ALIASES) {
            const size = readUint32(result, i)
            selvaStringProp(q, edgeDef, item, result, i + 4, size)
            i += size + 4
          } else if (t === CARDINALITY) {
            const size = readUint32(result, i)
            addField(edgeDef, readUint32(result, i + 4), item, false)
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
    } else if (index === 0) {
      i += readMain(q, result, i, item)
    } else {
      const prop = q.schema.reverseProps[index]
      if (prop.typeIndex === CARDINALITY) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        addField(prop, readUint32(result, i + 4), item, false)
        i += size + 4
      } else if (prop.typeIndex === JSON) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        selvaStringProp(q, prop, item, result, i + 4, size)
        i += size + 4
      } else if (prop.typeIndex === BINARY) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        selvaStringProp(q, prop, item, result, i + 4, size)
        i += size + 4
      } else if (prop.typeIndex === STRING) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        selvaStringProp(q, prop, item, result, i + 4, size)
        i += size + 4
      } else if (prop.typeIndex == TEXT) {
        const size = readUint32(result, i)
        if (size === 0) {
          // do nothing
        } else {
          if (q.lang.lang != 0) {
            q.include.propsRead[index] = id
            addField(prop, read(result, i + 4, size, true), item, false)
          } else {
            addField(
              prop,
              read(result, i + 4, size, true),
              item,
              false,
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
          addField(prop, '', item, false)
        } else {
          const string = readUtf8(result, i, size)
          i += size
          addField(prop, string, item, false)
        }
      } else if (prop.typeIndex === VECTOR || prop.typeIndex === COLVEC) {
        q.include.propsRead[index] = id
        const size = readUint32(result, i)
        i += 4
        const tmp = result.slice(i, i + size) // make a copy
        let arr:
          | Int8Array
          | Uint8Array
          | Int16Array
          | Uint16Array
          | Int32Array
          | Uint32Array
          | Float32Array
          | Float64Array
        switch (prop.vectorBaseType) {
          case 'int8':
            arr = new Int8Array(tmp.buffer)
            break
          case 'uint8':
            arr = new Uint8Array(tmp.buffer)
            break
          case 'int16':
            arr = new Int16Array(tmp.buffer)
            break
          case 'uint16':
            arr = new Uint16Array(tmp.buffer)
            break
          case 'int32':
            arr = new Int32Array(tmp.buffer)
            break
          case 'uint32':
            arr = new Uint32Array(tmp.buffer)
            break
          case 'float32':
            arr = new Float32Array(tmp.buffer)
            break
          case 'float64':
          case 'number':
            arr = new Float64Array(tmp.buffer)
            break
        }
        addField(prop, arr, item, false)
        i += size
      }
    }
  }
  handleUndefinedProps(id, q, item)
  return i - offset
}

export const resultToObject = (
  q: QueryDef,
  result: Uint8Array,
  end: number,
  offset: number = 0,
) => {
  if (q.aggregate) {
    return readAggregate(q, result, 0, result.byteLength - 4)
  }

  const len = readUint32(result, offset)

  if (len === 0) {
    if ('id' in q.target || 'alias' in q.target) {
      return null
    }
    return []
  }

  let items: AggItem | [Item] = []
  let i = 5 + offset

  const readHook = q.schema.hooks?.read
  while (i < end) {
    const id = readUint32(result, i)
    i += 4
    let item: Item = {
      id,
    }
    if (q.search) {
      item.$searchScore = readFloatLE(result, i)
      i += 4
    }
    const l = readAllFields(q, result, i, end, item, id)
    i += l
    if (readHook) {
      const res = readHook(item)
      if (res === null) {
        continue
      }
      items.push(res || item)
    } else {
      items.push(item)
    }
  }

  if ('id' in q.target || 'alias' in q.target) {
    if (q.type === QueryDefType.Root && q.target.type === '_root') {
      // Todo can be optimized
      delete items[0].id
    }
    return items[0]
  }

  return items
}

export function readNumber(
  value: Uint8Array,
  offset: number,
  type: TypeIndex,
): any {
  switch (type) {
    case NUMBER:
      return readDoubleLE(value, offset)
    case UINT16:
      return readUint16(value, offset)
    case UINT32:
      return readUint32(value, offset)
    case INT16:
      return readInt16(value, offset)
    case INT32:
      return readInt32(value, offset)
    case UINT8:
      return value[offset]
    case INT8:
      return value[offset]
  }
}
