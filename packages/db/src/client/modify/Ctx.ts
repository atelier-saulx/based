import { writeUint64 } from '@based/utils'
import type { SchemaTypeDef, PropDef } from '@based/schema/def'
import type { LangCode } from '@based/schema'
import { type ModifyOp } from './types.js'
import type { Tmp } from './Tmp.js'

export class Ctx {
  constructor(schemaChecksum: number, array: Uint8Array<ArrayBufferLike>) {
    this.array = array
    this.max = array.buffer.maxByteLength - 4 // dataLen
    this.size = array.buffer.byteLength - 4
    writeUint64(array, schemaChecksum, 0)
  }
  // id: number
  start: number
  index: number = 8
  schema: SchemaTypeDef
  array: Uint8Array<ArrayBufferLike>
  max: number
  size: number
  unsafe?: boolean
  overwrite?: boolean
  operation: ModifyOp
  main: Map<PropDef, any> = new Map()
  draining: Promise<void>
  scheduled: Promise<void>
  // created: Record<number, number> = {} // <typeId, count
  locale: LangCode
  sort: number = 0
  sortText: number = 0
  defaults: number = 0
  cursor: {
    // id?: number
    type?: number
    prop?: number
    main?: number
    operation?: ModifyOp
    upserting?: boolean
  } = {}
  batch: {
    count?: number
    promises?: Tmp[]
    res?: Uint8Array
    ready?: boolean
    error?: Error
  } = {}
}
