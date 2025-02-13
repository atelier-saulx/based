import {
  isPropType,
  SchemaObject,
  StrictSchemaType,
  getPropType,
  SchemaReference,
  SchemaLocales,
} from '@based/schema'
import { setByPath } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import {
  PropDef,
  SchemaTypeDef,
  SIZE_MAP,
  TYPE_INDEX_MAP,
  PropDefEdge,
} from './types.js'
import { DbClient } from '../../client/index.js'
import { DbServer } from '../index.js'
import { genId } from './utils.js'
import { DEFAULT_BLOCK_CAPACITY } from '../start.js'

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

      if (edge.typeIndex === 10) {
        edge.enum = Array.isArray(refProp[key])
          ? refProp[key]
          : refProp[key].enum
        edge.reverseEnum = {}
        for (let i = 0; i < edge.enum.length; i++) {
          edge.reverseEnum[edge.enum[i]] = i
        }
      } else if (edge.typeIndex === 14) {
        edge.inverseTypeName = refProp[key].items.ref
      } else if (edge.typeIndex === 13) {
        edge.inverseTypeName = refProp[key].ref
      }

      prop.edges[key] = edge
      prop.reverseEdges[edge.prop] = edge
    }
  }
}

export const updateTypeDefs = (db: DbClient | DbServer) => {
  for (const field in db.schemaTypesParsed) {
    if (field in db.schema.types) {
      continue
    }
    const id = db.schemaTypesParsed[field].id
    delete db.schemaTypesParsed[field]
    delete db.schemaTypesParsedById[id]
  }
  for (const field in db.schema.types) {
    const type = db.schema.types[field]
    if (
      db.schemaTypesParsed[field] &&
      db.schemaTypesParsed[field].checksum === hashObjectIgnoreKeyOrder(type) // bit weird..
    ) {
      continue
    } else {
      if (!type.id) {
        type.id = genId(db)
      }
      const def = createSchemaTypeDef(
        field,
        type,
        db.schemaTypesParsed,
        db.schema.locales ?? {
          en: {},
        },
      )
      def.blockCapacity =
        field === '_root' ? 2147483647 : DEFAULT_BLOCK_CAPACITY // TODO this should come from somewhere else
      db.schemaTypesParsed[field] = def
      db.schemaTypesParsedById[type.id] = def
    }
  }
}

export const createSchemaTypeDef = (
  typeName: string,
  type: StrictSchemaType | SchemaObject,
  parsed: DbClient['schemaTypesParsed'],
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
    stringPropsSize: 0,
    stringPropsLoop: [],
    main: {},
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

  result.idUint8[0] = result.id & 255
  result.idUint8[1] = result.id >> 8

  const encoder = new TextEncoder()
  const target = type.props
  let stringFields: number = 0

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
      let len = SIZE_MAP[propType]
      if (
        isPropType('string', schemaProp) ||
        isPropType('alias', schemaProp) ||
        isPropType('binary', schemaProp)
      ) {
        if (typeof schemaProp === 'object') {
          if (schemaProp.maxBytes < 61) {
            len = schemaProp.maxBytes + 1
          } else if ('max' in schemaProp && schemaProp.max < 31) {
            len = schemaProp.max * 2 + 1
          } else {
            stringFields++
          }
        } else {
          stringFields++
        }
      } else if (
        isPropType('text', schemaProp) ||
        isPropType('cardinality', schemaProp)
      ) {
        // TODO: maieutica
        stringFields++
      } else if (isPropType('vector', schemaProp)) {
        len = 4 * schemaProp.size
      }

      const isseparate = len === 0 || isPropType('vector', schemaProp)
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
      if (b.separate && (a.typeIndex === 14 || a.typeIndex === 13)) {
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

    result.buf = Buffer.allocUnsafe(len)
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

    result.propNames = Buffer.allocUnsafe(fieldNameLen)
    let lastWritten = 0
    for (const f of fieldNames) {
      result.propNames[lastWritten] = f.byteLength
      result.propNames.set(f, lastWritten + 1)
      lastWritten += f.byteLength + 1
    }

    // result.responseCtx = new BasedNode(result as SchemaTypeDef, parsed)

    if (stringFields > 0) {
      result.hasStringProp = true
      let max = 0
      for (const f of result.separate) {
        if (f.typeIndex === 11) {
          if (f.prop > max) {
            max = f.prop
          }
        }
      }
      result.stringProps = Buffer.allocUnsafe(max + 1)
      for (const f of result.separate) {
        if (f.typeIndex === 11) {
          result.stringProps[f.prop] = 1
          result.stringPropsLoop.push(f)
          result.stringPropsSize++
        }
      }
      result.stringPropsCurrent = Buffer.allocUnsafe(max + 1)
      result.stringProps.copy(result.stringPropsCurrent)
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
