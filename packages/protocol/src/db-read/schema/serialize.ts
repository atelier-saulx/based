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
import { TypeIndex, VectorBaseType } from '@based/schema/prop-types'

export type ReaderSchema2 = {
  readId: number
  // maybe current read id that you add
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
  meta: 1 << 0, // Bit 0
  enum: 1 << 1, // Bit 1
  vectorBaseType: 1 << 2, // Bit 2
  len: 1 << 3, // Bit 3
  locales: 1 << 4, // Bit 4
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
    console.log('enum later..')
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
    console.log('locales later')
  }
  header[keySize + 1] = options
}

const innerSerialize = (schema: ReaderSchema, blocks: Uint8Array[] = []) => {
  const top = new Uint8Array(3)
  top[0] = schema.type
  top[2] = schema.search ? 1 : 0

  blocks.push(top)
  if (schema.refs.schema) {
    top[1] = 0
    // parse prop first
    // then schema (similair to edges)
  } else {
    top[1] = 0
  }

  if (schema.search) {
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

  // 3 optional, 3 normal
  //   if (schema.edges) {
  //     const edges = new Uint8Array(3)
  //     edges[0] = TopLevelKeys.edges
  //     blocks.push(edges)
  //     let index = blocks.length - 1
  //     innerSerialize(schema.edges, blocks)
  //     writeUint16(edges, getSize(blocks, index), 1)
  //   }

  // agg
  return blocks
}

export const serialize = (schema: ReaderSchema) => {
  return concatUint8Arr(innerSerialize(schema))
}
