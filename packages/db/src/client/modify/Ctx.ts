import { SchemaTypeDef, PropDef } from '@based/schema/def'
import { ModifyOp } from './types.js'
import { writeUint64 } from '@based/utils'
import type { Tmp } from './Tmp.js'

export class Ctx {
  constructor(schemaChecksum: number, array: Uint8Array<ArrayBuffer>) {
    this.array = array
    this.max = array.buffer.maxByteLength - 4 // dataLen
    writeUint64(array, schemaChecksum, 0)
  }
  id: number
  index: number = 8
  schema: SchemaTypeDef
  array: Uint8Array<ArrayBuffer>
  max: number
  unsafe?: boolean
  overwrite?: boolean
  operation: ModifyOp
  main: Map<PropDef, any> = new Map()
  draining: Promise<void>
  scheduled: boolean
  created: Record<number, number> = {} // <typeId, count
  batch: {
    promises?: Tmp[]
    offsets?: Record<number, number>
  } = {}
  cursor: {
    type?: number
    prop?: number
    main?: number
    id?: number
  } = {}
}
