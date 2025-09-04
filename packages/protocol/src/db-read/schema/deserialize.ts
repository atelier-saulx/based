import { TypeIndex } from '@based/schema/prop-types'
import {
  ReaderPropDef,
  ReaderSchema,
  PROPERTY_BIT_MAP,
  DEF_BIT_MAP,
} from '../types.js'
import { DECODER, readUint16 } from '@based/utils'

const readPath = (
  p: Uint8Array,
  off: number,
): { path: string[]; size: number } => {
  const len = p[off]
  const path = new Array(len)
  let index = 1 + off
  let cnt = 0
  while (cnt != len) {
    const len = p[index]
    path[cnt] = DECODER.decode(p.subarray(index + 1, len + index + 1))
    index += len + 1
    cnt++
  }
  return { path, size: index - off }
}

const deSerializeProp = (
  p: Uint8Array,
  off: number,
  keySize: 1 | 2,
): { def: ReaderPropDef; size: number; key: number } => {
  const key = keySize === 1 ? p[off] : readUint16(p, off)

  const map = p[off + keySize + 1]
  const path = readPath(p, off + 2 + keySize)
  const prop: ReaderPropDef = {
    typeIndex: p[off + keySize] as TypeIndex,
    path: path.path,
    readBy: 0,
  }

  let index = keySize + 2 + off + path.size

  if (map & PROPERTY_BIT_MAP.meta) {
    prop.meta = p[index]
    index++
  }
  if (map & PROPERTY_BIT_MAP.enum) {
    const useJSON = p[index] === 1
    index += 1
    if (useJSON) {
      const size = readUint16(p, index)
      index += 2
      prop.enum = JSON.parse(DECODER.decode(p.subarray(index, index + size)))
      index += size
    } else {
      const len = p[index]
      index++
      let cnt = 0
      prop.enum = new Array(len)
      while (cnt !== len) {
        const len = p[index]
        prop.enum[cnt] = DECODER.decode(p.subarray(index + 1, len + index + 1))
        index += len + 1
        cnt++
      }
    }
  }
  if (map & PROPERTY_BIT_MAP.vectorBaseType) {
    prop.vectorBaseType = p[index] + 1
    index++
  }
  if (map & PROPERTY_BIT_MAP.len) {
    prop.len = readUint16(p, index)
    index += 2
  }
  if (map & PROPERTY_BIT_MAP.locales) {
    prop.locales = {}
    const end = p[index] * 4 + index + 1
    index++
    while (index < end) {
      prop.locales[readUint16(p, index)] = DECODER.decode(
        p.subarray(index + 2, index + 4),
      )
      index += 4
    }
  }
  return { def: prop, key, size: index - off }
}

const deSerializeSchemaInner = (
  schema: Uint8Array,
  offset: number = 0,
): { schema: ReaderSchema; size: number } => {
  let i = offset

  const map = schema[i + 1]

  const s: Partial<ReaderSchema> = {
    readId: 0,
    type: schema[i],
    search: (map & DEF_BIT_MAP.search) !== 0,
    refs: {},
    props: {},
    main: { len: 0, props: {} },
  }
  i += 2

  if (map & DEF_BIT_MAP.refs) {
    const ref = schema[i]
    i++
    let count = 0
    while (count != ref) {
      const { def, key, size } = deSerializeProp(schema, i, 1)
      // @ts-ignore
      s.refs[key] = { prop: def }
      i += size
      const x = deSerializeSchemaInner(schema, i)
      s.refs[key].schema = x.schema
      i += x.size
      count++
    }
  }

  if (map & DEF_BIT_MAP.props) {
    const propsLen = schema[i]
    i++
    let count = 0
    while (count != propsLen) {
      const { def, key, size } = deSerializeProp(schema, i, 1)
      s.props[key] = def
      i += size
      count++
    }
  }

  if (map & DEF_BIT_MAP.main) {
    const mainLen = readUint16(schema, i)
    i += 2
    if (mainLen) {
      let count = 0
      const mainPropsLen = readUint16(schema, i)
      s.main.len = mainLen
      const keySize = mainLen > 255 ? 2 : 1
      i += 2
      while (count != mainPropsLen) {
        const { def, key, size } = deSerializeProp(schema, i, keySize)
        s.main.props[key] = def
        i += size
        count++
      }
    }
  }

  if (map & DEF_BIT_MAP.edges) {
    const x = deSerializeSchemaInner(schema, i)
    s.edges = x.schema
    i += x.size
  }

  if (map & DEF_BIT_MAP.hook) {
    const len = readUint16(schema, i)
    i += 2
    const fn = `return (${DECODER.decode(schema.subarray(i, i + len))})(n);`
    // @ts-ignore
    s.hook = new Function('n', fn)
    i += len
  }

  if (map & DEF_BIT_MAP.aggregate) {
    const len = readUint16(schema, i)
    i += 2
    s.aggregate = JSON.parse(DECODER.decode(schema.subarray(i, i + len)))
    if (s.aggregate.groupBy?.display) {
      s.aggregate.groupBy.display = new Intl.DateTimeFormat(
        // @ts-ignore
        s.aggregate.groupBy.display.locale,
        // @ts-ignore
        s.aggregate.groupBy.display,
      )
    }
    i += len
  }

  return { schema: s as ReaderSchema, size: i - offset }
}

export const deSerializeSchema = (schema: Uint8Array, offset: number = 0) => {
  return deSerializeSchemaInner(schema, offset).schema
}
