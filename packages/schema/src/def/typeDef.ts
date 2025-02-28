import {
  isPropType,
  SchemaObject,
  StrictSchemaType,
  getPropType,
  SchemaReference,
  SchemaLocales,
} from '../index.js'
import { setByPath } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import {
  PropDef,
  SchemaTypeDef,
  SIZE_MAP,
  TYPE_INDEX_MAP,
  PropDefEdge,
  STRING,
  ALIAS,
  CARDINALITY,
  REFERENCES,
  REFERENCE,
  TEXT,
  SchemaTypesParsedById,
  SchemaTypesParsed,
  ENUM,
} from './types.js'
import { SchemaProp, StrictSchema } from '../types.js'

// TMP
export const DEFAULT_BLOCK_CAPACITY = 100_000

function getPropLen(schemaProp: SchemaProp)
{
  let len = SIZE_MAP[getPropType(schemaProp)]
  if (
    isPropType('string', schemaProp) ||
    isPropType('alias', schemaProp) ||
    isPropType('cardinality', schemaProp)
  ) {
    if (typeof schemaProp === 'object') {
      if (schemaProp.maxBytes < 61) {
        len = schemaProp.maxBytes + 1
      } else if ('max' in schemaProp && schemaProp.max < 31) {
        len = schemaProp.max * 2 + 1
      }
    }
  } else if (isPropType('vector', schemaProp)) {
    len = 4 * schemaProp.size
  }

  return len
}

function isSeparate(schemaProp: SchemaProp, len: number)
{
  return len === 0 || isPropType('vector', schemaProp)
}

const addEdges = (prop: PropDef, refProp: SchemaReference) => {
  let edgesCnt = 0
  for (const key in refProp) {
    if (key[0] === '$') {
      if (!prop.edges) {
        prop.edges = {}
        prop.reverseEdges = {}
        prop.edgesTotalLen = 0
      }
      edgesCnt++
      const edgeType = getPropType(refProp[key])
      const edge: PropDefEdge = {
        __isPropDef: true,
        __isEdge: true,
        prop: edgesCnt,
        name: key,
        typeIndex: TYPE_INDEX_MAP[edgeType],
        len: SIZE_MAP[edgeType],
        separate: true,
        path: [...prop.path, key],
      }

      if (edge.len == 0) {
        prop.edgesTotalLen = 0
      } else {
        // [field] [size] [data]
        prop.edgesTotalLen += 1 + 2 + edge.len // field len
      }

      if (edge.typeIndex === ENUM) {
        edge.enum = Array.isArray(refProp[key])
          ? refProp[key]
          : refProp[key].enum
        edge.reverseEnum = {}
        for (let i = 0; i < edge.enum.length; i++) {
          edge.reverseEnum[edge.enum[i]] = i
        }
      } else if (edge.typeIndex === REFERENCES) {
        edge.inverseTypeName = refProp[key].items.ref
      } else if (edge.typeIndex === REFERENCE) {
        edge.inverseTypeName = refProp[key].ref
      }

      prop.edges[key] = edge
      prop.reverseEdges[edge.prop] = edge
    }
  }
}

export const updateTypeDefs = (
  schema: StrictSchema,
  schemaTypesParsed: SchemaTypesParsed,
  schemaTypesParsedById: SchemaTypesParsedById,
) => {
  for (const field in schemaTypesParsed) {
    if (field in schema.types) {
      continue
    }
    const id = schemaTypesParsed[field].id
    delete schemaTypesParsed[field]
    delete schemaTypesParsedById[id]
  }
  for (const field in schema.types) {
    const type = schema.types[field]
    if (
      schemaTypesParsed[field] &&
      schemaTypesParsed[field].checksum === hashObjectIgnoreKeyOrder(type) // bit weird..
    ) {
      continue
    } else {
      if (!type.id) {
        throw new Error('NEED ID ON TYPE')
      }
      const def = createSchemaTypeDef(
        field,
        type,
        schemaTypesParsed,
        schema.locales ?? {
          en: {},
        },
      )
      def.blockCapacity =
        field === '_root' ? 2147483647 : DEFAULT_BLOCK_CAPACITY // TODO this should come from somewhere else
      schemaTypesParsed[field] = def
      schemaTypesParsedById[type.id] = def
    }
  }
}

export const createSchemaTypeDef = (
  typeName: string,
  type: StrictSchemaType | SchemaObject,
  parsed: SchemaTypesParsed,
  locales: Partial<SchemaLocales>,
  result: Partial<SchemaTypeDef> = {
    cnt: 0,
    checksum: hashObjectIgnoreKeyOrder(type),
    type: typeName,
    props: {},
    reverseProps: {},
    idUint8: new Uint8Array([0, 0]),
    id: 0,
    mainLen: 0,
    separate: [],
    tree: {},
    total: 0,
    lastId: 0,
    main: {},
    hasSeperateSort: false,
    seperateSort: {
      size: 0,
      props: [],
      buffer: new Uint8Array([]),
      bufferTmp: new Uint8Array([]),
    },
    hasSeperateTextSort: false,
    seperateTextSort: {
      size: 0, // prop len
      props: [],
      buffer: new Uint8Array([]),
      bufferTmp: new Uint8Array([]),
    },
  },
  path: string[] = [],
  top: boolean = true,
): SchemaTypeDef => {
  if (result.id == 0 && top) {
    if ('id' in type) {
      result.id = type.id
    } else {
      throw new Error(`Invalid schema type id ${result.type}`)
    }
  }
  result.locales = locales
  result.localeSize = Object.keys(locales).length
  result.idUint8[0] = result.id & 255
  result.idUint8[1] = result.id >> 8

  const encoder = new TextEncoder()
  const target = type.props
  let separateSortProps: number = 0
  let separateSortText: number = 0

  for (const key in target) {
    const schemaProp = target[key]
    const propPath = [...path, key]
    const propType = getPropType(schemaProp)
    if (propType === 'object') {
      createSchemaTypeDef(
        typeName,
        schemaProp as SchemaObject,
        parsed,
        locales,
        result,
        propPath,
        false,
      )
    } else {
      const len = getPropLen(schemaProp)
      if (
        isPropType('string', schemaProp) ||
        isPropType('alias', schemaProp) ||
        isPropType('cardinality', schemaProp)
      ) {
        if (typeof schemaProp === 'object') {
          if (!(schemaProp.maxBytes < 61) || !('max' in schemaProp && schemaProp.max < 31)) {
            separateSortProps++
          }
        } else {
          separateSortProps++
        }
      } else if (isPropType('text', schemaProp)) {
        separateSortText++
      }

      const isseparate = isSeparate(schemaProp, len)
      if (isseparate) {
        result.cnt++
      }
      const prop: PropDef = {
        typeIndex: TYPE_INDEX_MAP[propType],
        __isPropDef: true,
        separate: isseparate,
        path: propPath,
        start: 0,
        len,
        prop: isseparate ? result.cnt : 0,
      }
      if (isPropType('enum', schemaProp)) {
        prop.enum = Array.isArray(schemaProp) ? schemaProp : schemaProp.enum
        prop.reverseEnum = {}
        for (let i = 0; i < prop.enum.length; i++) {
          prop.reverseEnum[prop.enum[i]] = i
        }
      } else if (isPropType('references', schemaProp)) {
        prop.inversePropName = schemaProp.items.prop
        prop.inverseTypeName = schemaProp.items.ref
        prop.dependent = schemaProp.items.dependent
        addEdges(prop, schemaProp.items)
      } else if (isPropType('reference', schemaProp)) {
        prop.inversePropName = schemaProp.prop
        prop.inverseTypeName = schemaProp.ref
        prop.dependent = schemaProp.dependent
        addEdges(prop, schemaProp)
      } else if (typeof schemaProp === 'object') {
        if (
          isPropType('string', schemaProp) ||
          isPropType('text', schemaProp)
        ) {
          prop.compression =
            'compression' in schemaProp && schemaProp.compression === 'none'
              ? 0
              : 1
        } else if (isPropType('timestamp', schemaProp) && 'on' in schemaProp) {
          if (schemaProp.on[0] === 'c') {
            result.createTs ??= []
            result.createTs.push(prop)
          } else if (schemaProp.on[0] === 'u') {
            result.createTs ??= []
            result.createTs.push(prop)
            result.updateTs ??= []
            result.updateTs.push(prop)
          }
        }
      }
      result.props[propPath.join('.')] = prop
      if (isseparate) {
        result.separate.push(prop)
      }
    }
  }

  if (top) {
    const vals = Object.values(result.props)

    vals.sort((a, b) => {
      if (
        b.separate &&
        (a.typeIndex === REFERENCES || a.typeIndex === REFERENCE)
      ) {
        return -1
      }
      return a.prop - b.prop
    })

    let lastProp = 0
    for (const p of vals) {
      if (p.separate) {
        lastProp++
        p.prop = lastProp
      }
    }

    let len = 2
    for (const f of vals) {
      if (f.separate) {
        len += 2
        setByPath(result.tree, f.path, f)
      } else {
        if (!result.mainLen) {
          len += 2
        }
        len += 1
        f.start = result.mainLen
        result.mainLen += f.len
        setByPath(result.tree, f.path, f)
      }
    }

    const mainFields: PropDef[] = []
    const restFields: PropDef[] = []

    for (const f of vals) {
      if (f.separate) {
        restFields.push(f)
      } else {
        mainFields.push(f)
      }
    }

    // make packed version
    result.buf = new Uint8Array(len)
    result.buf[0] = result.idUint8[0]
    result.buf[1] = result.idUint8[1]
    const fieldNames = []
    const tNameBuf = encoder.encode(typeName)
    fieldNames.push(tNameBuf)
    let fieldNameLen = tNameBuf.byteLength + 1
    let i = 2
    if (result.mainLen) {
      result.buf[i] = 0
      for (const f of vals) {
        if (!f.separate) {
          i++
          result.buf[i] = f.typeIndex
          const name = encoder.encode(f.path.join('.'))
          fieldNames.push(name)
          fieldNameLen += name.byteLength + 1
        }
      }
      i++
      result.buf[i] = 0
    }
    for (const f of vals) {
      if (f.separate) {
        i++
        result.buf[i] = f.prop
        i++
        result.buf[i] = f.typeIndex
        const name = encoder.encode(f.path.join('.'))
        fieldNames.push(name)
        fieldNameLen += name.byteLength + 1
      }
    }
    result.propNames = new Uint8Array(fieldNameLen)
    let lastWritten = 0
    for (const f of fieldNames) {
      result.propNames[lastWritten] = f.byteLength
      result.propNames.set(f, lastWritten + 1)
      lastWritten += f.byteLength + 1
    }

    let bufLen = result.buf.length
    result.packed = new Uint8Array(2 + bufLen + result.propNames.length)
    result.packed[0] = bufLen
    result.packed[1] = bufLen >>>= 8
    result.packed.set(result.buf, 2)
    result.packed.set(result.propNames, result.buf.length + 2)

    // done making packed bversion

    if (separateSortText > 0) {
      result.hasSeperateTextSort = true
      let max = 0
      for (const f of result.separate) {
        if (f.typeIndex === TEXT) {
          if (f.prop > max) {
            max = f.prop
          }
        }
      }
      result.seperateTextSort.buffer = new Uint8Array(
        max * result.localeSize + 1,
      )
      for (const f of result.separate) {
        if (f.typeIndex === TEXT) {
          result.seperateTextSort.buffer[f.prop] = 1
          result.seperateTextSort.props.push(f)
          result.seperateTextSort.size += result.localeSize
        }
      }
      result.seperateTextSort.bufferTmp = new Uint8Array(
        max * result.localeSize + 1,
      )
      result.seperateTextSort.buffer.set(result.seperateTextSort.bufferTmp)
    }

    if (separateSortProps > 0) {
      result.hasSeperateSort = true
      let max = 0
      for (const f of result.separate) {
        if (
          f.typeIndex === STRING ||
          f.typeIndex === ALIAS ||
          f.typeIndex === CARDINALITY
        ) {
          if (f.prop > max) {
            max = f.prop
          }
        }
      }
      result.seperateSort.buffer = new Uint8Array(max + 1)
      for (const f of result.separate) {
        if (
          f.typeIndex === STRING ||
          f.typeIndex === ALIAS ||
          f.typeIndex === CARDINALITY
        ) {
          result.seperateSort.buffer[f.prop] = 1
          result.seperateSort.props.push(f)
          result.seperateSort.size++
        }
      }
      result.seperateSort.bufferTmp = new Uint8Array(max + 1)
      result.seperateSort.buffer.set(result.seperateSort.bufferTmp)
    }

    for (const p in result.props) {
      const x = result.props[p]
      if (!x.separate) {
        result.main[x.start] = x
      } else {
        result.reverseProps[x.prop] = x
      }
    }
  }

  return result as SchemaTypeDef
}
