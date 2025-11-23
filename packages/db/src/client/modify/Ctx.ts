import { writeUint64 } from '@based/utils'
import type { SchemaTypeDef, PropDef } from '@based/schema/def'
import type { LangCode } from '@based/schema'
import type { Tmp } from './Tmp.js'
import type { ModOpEnum } from '../../zigTsExports.js'

export class Ctx {
  constructor(schemaChecksum: number, array: Uint8Array<ArrayBufferLike>) {
    this.array = array
    this.max = array.buffer.maxByteLength - 4 // dataLen
    this.size = array.buffer.byteLength - 4
    array[4] = 10 // make enum later 1 means normal MODIFY
    writeUint64(array, schemaChecksum, 5)
  }
  start: number
  index: number = 5 + 8 // 8 for schema checksum and 5 for mod ID + mod type
  schema: SchemaTypeDef
  array: Uint8Array<ArrayBufferLike>
  max: number
  size: number
  unsafe?: boolean
  operation: ModOpEnum
  main: Map<PropDef, any> = new Map()
  draining: Promise<void>
  scheduled: Promise<void>
  locale: LangCode
  sort: number = 0
  sortText: number = 0
  defaults: number = 0
  cursor: {
    type?: number
    prop?: number
    main?: number
    operation?: ModOpEnum
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
