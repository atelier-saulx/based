import type { SchemaHooks } from '../../../schema/index.js'
import {
  ReadAggregateSchema,
  ReadProp,
  ReadSchema,
  ReadSchemaEnum,
  PROPERTY_BIT_MAP,
  DEF_BIT_MAP,
  GROUP_BY_BIT_MAP,
} from '../types.js'
import {
  concatUint8Arr,
  ENCODER,
  isEmptyObject,
  writeDoubleLE,
  writeUint16,
  writeUint32,
} from '../../../utils/index.js'

export type ReadSchema2 = {
  readId: number
  props: { [prop: string]: ReadProp }
  main: { props: { [start: string]: ReadProp }; len: number }
  type: ReadSchemaEnum
  refs: {
    [prop: string]: {
      schema: ReadSchema
      prop: ReadProp
    }
  }
  hook?: SchemaHooks['read']
  aggregate?: ReadAggregateSchema
  edges?: ReadSchema
  search?: boolean
}

const serializeAggregate = (
  agg: ReadAggregateSchema['aggregates'][number],
  blocks: Uint8Array[],
) => {
  const header = new Uint8Array(6)
  header[0] = agg.type
  blocks.push(header)
  writeUint32(header, agg.resultPos, 1)
  header[5] = agg.path.length
  for (const p of agg.path) {
    const n = ENCODER.encode(p)
    blocks.push(new Uint8Array([n.byteLength]), n)
  }
}

const serializeEnum = (
  prop: { [key: string]: any; enum?: any[] },
  blocks: Uint8Array[],
) => {
  let useJSON = false
  const tmp: Uint8Array[] = []
  for (const p of prop.enum!) {
    if (typeof p !== 'string') {
      useJSON = true
      break
    } else {
      const n = ENCODER.encode(p)
      tmp.push(new Uint8Array([n.byteLength]), n)
    }
  }
  if (useJSON) {
    blocks.push(new Uint8Array([1]))
    const s = ENCODER.encode(JSON.stringify(prop.enum))
    const x = new Uint8Array(s.byteLength + 2)
    writeUint16(x, s.byteLength, 0)
    x.set(s, 2)
    blocks.push(x)
  } else {
    blocks.push(new Uint8Array([0, prop.enum!.length]), ...tmp)
  }
}

const serializeAggregates = (
  agg: ReadAggregateSchema,
  blocks: Uint8Array[],
) => {
  const header = new Uint8Array(5)

  header[0] = agg.aggregates.length
  writeUint32(header, agg.totalResultsSize, 1)

  blocks.push(header)
  for (const a of agg.aggregates) {
    serializeAggregate(a, blocks)
  }

  if (agg.groupBy && agg.groupBy.length > 0) {
    for (const g of agg.groupBy) {
      let options = 0
      const opts = new Uint8Array([1, 0, g.typeIndex])
      blocks.push(opts)
      if ('stepRange' in g) {
        options |= GROUP_BY_BIT_MAP.stepRange
        const step = new Uint8Array(8)
        writeDoubleLE(step, g.stepRange!, 0)
        blocks.push(step)
      }
      if ('stepType' in g) {
        options |= GROUP_BY_BIT_MAP.stepType
      }
      if ('display' in g) {
        options |= GROUP_BY_BIT_MAP.display
        const displayString = JSON.stringify(g.display!.resolvedOptions())
        const n = ENCODER.encode(displayString)
        const sizeHeader = new Uint8Array(2)
        writeUint16(sizeHeader, n.byteLength, 0)
        blocks.push(sizeHeader, n)
      }
      if ('enum' in g) {
        options |= GROUP_BY_BIT_MAP.enum
        serializeEnum(g, blocks)
      }
      opts[0] = options
    }
  } else {
    blocks.push(new Uint8Array([0]))
  }
}

const serializeProp = (
  key: number,
  keySize: 1 | 2,
  prop: ReadProp,
  blocks: Uint8Array[],
) => {
  const header = new Uint8Array(3 + keySize)
  if (keySize === 1) {
    header[0] = key
  } else if (keySize === 2) {
    writeUint16(header, key, 0)
  }

  header[keySize] = prop.type
  // 2 opions
  header[keySize + 2] = prop.path.length
  blocks.push(header)

  for (const p of prop.path) {
    const n = ENCODER.encode(p)
    blocks.push(new Uint8Array([n.byteLength]), n)
  }
  // Optional things
  let options = 0
  if ('meta' in prop) {
    options |= PROPERTY_BIT_MAP.meta
    blocks.push(new Uint8Array([prop.meta as number]))
  }
  if ('enum' in prop) {
    options |= PROPERTY_BIT_MAP.enum
    serializeEnum(prop, blocks)
  }
  if ('vectorBaseType' in prop) {
    options |= PROPERTY_BIT_MAP.vectorBaseType
    // Size 8
    blocks.push(new Uint8Array([prop.vectorBaseType! - 1]))
  }
  if ('len' in prop) {
    options |= PROPERTY_BIT_MAP.len
    const len = new Uint8Array(2)
    writeUint16(len, prop.len!, 0)
    blocks.push(len)
  }
  if ('locales' in prop) {
    const keys = Object.keys(prop.locales!)
    const localesHasMeta = keys.find((k) => !!prop.locales![k].meta)
    const len = keys.length
    let i = 1
    if (localesHasMeta) {
      options |= PROPERTY_BIT_MAP.localesWithMeta
      const locales = new Uint8Array(len * 5 + 1)
      for (const key of keys) {
        const lang = prop.locales![key]
        locales[i] = lang.meta ?? 0
        writeUint16(locales, Number(key), i + 1)
        ENCODER.encodeInto(lang.name, locales.subarray(i + 3, i + 5))
        i += 5
      }
      locales[0] = len
      blocks.push(locales)
    } else {
      options |= PROPERTY_BIT_MAP.locales
      const locales = new Uint8Array(len * 4 + 1)
      for (const key of keys) {
        writeUint16(locales, Number(key), i)
        ENCODER.encodeInto(
          prop.locales![key].name,
          locales.subarray(i + 2, i + 4),
        )
        i += 4
      }
      locales[0] = len
      blocks.push(locales)
    }
  }
  header[keySize + 1] = options
}

const innerSerialize = (schema: ReadSchema, blocks: Uint8Array[] = []) => {
  const top = new Uint8Array(2)
  top[0] = schema.type

  // DEF_BIT_MAP
  let options = 0

  // top[1]
  if (schema.search) {
    options |= DEF_BIT_MAP.search
  }

  blocks.push(top)

  if (!isEmptyObject(schema.refs)) {
    options |= DEF_BIT_MAP.refs
    const refsHeader = new Uint8Array(1)
    blocks.push(refsHeader)
    let cnt = 0
    for (const key in schema.refs) {
      serializeProp(Number(key), 1, schema.refs[key].prop, blocks)
      innerSerialize(schema.refs[key].schema, blocks)
      cnt++
    }
    refsHeader[0] = cnt
  }

  if (!isEmptyObject(schema.props)) {
    options |= DEF_BIT_MAP.props
    const propsHeader = new Uint8Array(1)
    blocks.push(propsHeader)
    let count = 0
    for (const key in schema.props) {
      count++
      serializeProp(Number(key), 1, schema.props[key], blocks)
    }
    propsHeader[0] = count
  }

  const mainLen = schema.main.len

  if (mainLen > 0) {
    options |= DEF_BIT_MAP.main
    const mainBlock = new Uint8Array(2)
    writeUint16(mainBlock, mainLen, 0)
    blocks.push(mainBlock)
    const keySize = mainLen > 255 ? 2 : 1
    const propsHeader = new Uint8Array(2)
    blocks.push(propsHeader)
    let count = 0
    for (const key in schema.main.props) {
      count++
      serializeProp(Number(key), keySize, schema.main.props[key], blocks)
    }
    writeUint16(propsHeader, count, 0)
  }

  if (schema.edges) {
    options |= DEF_BIT_MAP.edges
    innerSerialize(schema.edges, blocks)
  }

  if (schema.hook) {
    options |= DEF_BIT_MAP.hook
    let src = schema.hook.toString()
    // later prep this correctly in the schema file when updating it
    // and run dry run
    if (/^[a-zA-Z0-9_$]+\s*\(/.test(src)) {
      src = 'function ' + src
    }
    const n = ENCODER.encode(src)
    const x = new Uint8Array(n.byteLength + 2)
    writeUint16(x, n.byteLength, 0)
    x.set(n, 2)
    blocks.push(x)
  }

  if (schema.aggregate) {
    options |= DEF_BIT_MAP.aggregate
    serializeAggregates(schema.aggregate, blocks)
  }

  // Options bitmap
  top[1] = options

  return blocks
}

export const serializeReadSchema = (schema: ReadSchema) => {
  return concatUint8Arr(innerSerialize(schema))
}
