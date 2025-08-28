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
  prop: ReaderPropDef,
  blocks: Uint8Array[],
) => {
  const header = new Uint8Array(4)
  header[0] = key
  header[1] = prop.typeIndex
  // 2 opions
  header[3] = prop.path.length
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
  header[2] = options
}

const innerSerialize = (schema: ReaderSchema, blocks: Uint8Array[] = []) => {
  const top = new Uint8Array(2)
  top[0] = schema.type
  blocks.push(top)
  if (schema.refs.schema) {
    top[1] = 0
    // parse prop first
    // then schema (similair to edges)
  } else {
    top[1] = 0
  }

  if (isEmptyObject(schema.props)) {
    blocks.push(new Uint8Array([0]))
  } else {
    const propsHeader = new Uint8Array(1)
    blocks.push(propsHeader)
    let size = 0
    for (const key in schema.props) {
      size++
      serializeProp(Number(key), schema.props[key], blocks)
    }
    propsHeader[0] = size
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

  //   if (schema.search) {
  //     blocks.push(new Uint8Array([TopLevelKeys.search]))
  //   }

  // agg
  return blocks
}

export const serialize = (schema: ReaderSchema) => {
  return concatUint8Arr(innerSerialize(schema))
}
