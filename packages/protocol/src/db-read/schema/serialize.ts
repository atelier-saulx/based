import type { SchemaHooks } from '@based/schema'
import {
  ReaderAggregateSchema,
  ReaderPropDef,
  ReaderSchema,
  ReaderSchemaEnum,
} from '../types.js'
import {
  concatUint8Arr,
  ENCODER,
  isEmptyObject,
  writeUint16,
} from '@based/utils'

export type ReaderSchema2 = {
  readId: number
  props: { [prop: string]: ReaderPropDef }
  main: { props: { [start: string]: ReaderPropDef }; len: number }
  type: ReaderSchemaEnum
  refs: {
    [prop: string]: {
      schema: ReaderSchema
      prop: ReaderPropDef
    }
  }
  hook?: SchemaHooks['read']
  aggregate?: ReaderAggregateSchema
  edges?: ReaderSchema
  search?: boolean
}

const getSize = (blocks: Uint8Array[], offset: number = 0): number => {
  let total = 0
  for (let i = offset; i < blocks.length; i++) {
    total += blocks[i].byteLength
  }
  return total
}

const PROPERTY_MAP = {
  meta: 1 << 0,
  enum: 1 << 1,
  vectorBaseType: 1 << 2,
  len: 1 << 3,
  locales: 1 << 4,
}

const serializeProp = (
  key: number,
  keySize: 1 | 2,
  prop: ReaderPropDef,
  blocks: Uint8Array[],
) => {
  const header = new Uint8Array(3 + keySize)
  if (keySize === 1) {
    header[0] = key
  } else if (keySize === 2) {
    writeUint16(header, key, 0)
  }

  header[keySize] = prop.typeIndex
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
    //   1 or 2
    options |= PROPERTY_MAP.meta
    blocks.push(new Uint8Array([prop.meta]))
  }
  if ('enum' in prop) {
    options |= PROPERTY_MAP.enum
    let useJSON = false
    const tmp: Uint8Array[] = []
    for (const p of prop.enum) {
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
      blocks.push(new Uint8Array([0, prop.enum.length]), ...tmp)
    }
  }
  if ('vectorBaseType' in prop) {
    options |= PROPERTY_MAP.vectorBaseType
    // Size 8
    blocks.push(new Uint8Array([prop.vectorBaseType - 1]))
  }
  if ('len' in prop) {
    options |= PROPERTY_MAP.len
    const len = new Uint8Array(2)
    writeUint16(len, prop.len, 0)
    blocks.push(len)
  }
  if ('locales' in prop) {
    options |= PROPERTY_MAP.locales
    const keys = Object.keys(prop.locales)
    const len = keys.length
    const locales = new Uint8Array(len * 4 + 1)
    let i = 1
    for (const key of keys) {
      writeUint16(locales, Number(key), i)
      ENCODER.encodeInto(prop.locales[key], locales.subarray(i + 2, i + 4))
      i += 4
    }
    locales[0] = len
    blocks.push(locales)
  }
  header[keySize + 1] = options
}

const innerSerialize = (schema: ReaderSchema, blocks: Uint8Array[] = []) => {
  const top = new Uint8Array(3)
  top[0] = schema.type
  top[1] = schema.search ? 1 : 0

  blocks.push(top)
  if (!isEmptyObject(schema.refs)) {
    let cnt = 0
    for (const key in schema.refs) {
      serializeProp(Number(key), 1, schema.refs[key].prop, blocks)
      innerSerialize(schema.refs[key].schema, blocks)
      cnt++
    }
    top[2] = cnt
  } else {
    top[2] = 0
  }

  if (isEmptyObject(schema.props)) {
    blocks.push(new Uint8Array([0]))
  } else {
    const propsHeader = new Uint8Array(1)
    blocks.push(propsHeader)
    let count = 0
    for (const key in schema.props) {
      count++
      serializeProp(Number(key), 1, schema.props[key], blocks)
    }
    propsHeader[0] = count
  }

  const mainBlock = new Uint8Array(2)
  writeUint16(mainBlock, schema.main.len, 0)
  blocks.push(mainBlock)
  if (schema.main.len) {
    const propsHeader = new Uint8Array(1)
    blocks.push(propsHeader)
    let count = 0
    for (const key in schema.main.props) {
      count++
      serializeProp(Number(key), 2, schema.main.props[key], blocks)
    }
    propsHeader[0] = count
  }

  if (!schema.edges) {
    blocks.push(new Uint8Array([0]))
  } else {
    if (schema.edges) {
      blocks.push(new Uint8Array([1]))
      innerSerialize(schema.edges, blocks)
    }
  }

  if (!schema.hook) {
    blocks.push(new Uint8Array([0]))
  } else {
    const n = ENCODER.encode(schema.hook.toString())
    const x = new Uint8Array(n.byteLength + 2)
    writeUint16(x, n.byteLength, 0)
    x.set(n, 2)
    blocks.push(x)
  }

  if (!schema.aggregate) {
    blocks.push(new Uint8Array([0]))
  } else {
    const n = ENCODER.encode(
      JSON.stringify(schema.aggregate, (k, v) => {
        if (k === 'groupBy' && v.display) {
          return { ...v, display: v.display.resolvedOptions() }
        }
        return v
      }),
    )
    const x = new Uint8Array(n.byteLength + 2)
    writeUint16(x, n.byteLength, 0)
    x.set(n, 2)
    blocks.push(x)
  }

  return blocks
}

export const serialize = (schema: ReaderSchema) => {
  return concatUint8Arr(innerSerialize(schema))
}
