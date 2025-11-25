import type { Tmp } from './Tmp.js'
import { OpType, type ModOpEnum } from '../../zigTsExports.js'
import type { LangCode, PropDef, SchemaTypeDef } from '../../schema/index.js'
import { writeUint64 } from '../../utils/uint8.js'

export const MODIFY_HEADER_SIZE = 1 + 4 + 8 + 4

export class Ctx {
  constructor(schemaChecksum: number, buf: Uint8Array<ArrayBufferLike>) {
    this.buf = buf
    buf[4] = OpType.modify // make enum later 1 means normal MODIFY
    writeUint64(buf, schemaChecksum, 5)
    this.reset()
  }
  reset() {
    this.index = MODIFY_HEADER_SIZE // 5 for id + type + schema checksum + operation count
    this.max = this.buf.buffer.maxByteLength
    this.size = this.buf.buffer.byteLength
    this.cursor = {}
    this.batch = {}
  }
  start: number
  index: number
  schema: SchemaTypeDef
  buf: Uint8Array<ArrayBufferLike>
  max: number
  size: number
  unsafe?: boolean
  operation: ModOpEnum
  main: Map<PropDef, any> = new Map()
  draining: Promise<void>
  scheduled: Promise<void> | undefined
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
