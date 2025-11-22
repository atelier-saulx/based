import { writeUint64 } from '@based/utils'
import type { LangCode, MainDef, SchemaOut, TypeDef } from '@based/schema'
import { type ModifyOp } from './types.js'
import type { Tmp } from './Tmp.js'

export class Ctx {
  constructor(schema: SchemaOut, array: Uint8Array<ArrayBufferLike>) {
    this.array = array
    this.max = array.buffer.maxByteLength - 4 // dataLen
    this.size = array.buffer.byteLength - 4
    this.schema = schema
    writeUint64(array, schema.hash, 0)
  }
  schema: SchemaOut
  start: number
  index: number = 8
  typeDef: TypeDef
  array: Uint8Array<ArrayBufferLike>
  max: number
  size: number
  unsafe?: boolean
  operation: ModifyOp
  main: Map<MainDef, any> = new Map()
  draining: Promise<void>
  scheduled?: Promise<void>
  locale: LangCode
  sort: number = 0
  sortText: number = 0
  defaults: number = 0
  cursor: {
    type?: number
    prop?: number
    main: number
    operation?: ModifyOp
    upserting?: boolean
  } = {
    main: 0,
  }
  batch: {
    count?: number
    promises?: Tmp[]
    res?: Uint8Array
    ready?: boolean
    error?: Error
  } = {}
}
