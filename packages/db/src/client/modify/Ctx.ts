import { SchemaTypeDef, PropDef } from '@based/schema/def'
import { ModifyOp } from './types.js'
import { writeUint64 } from '@based/utils'

export class Ctx {
  constructor(schemaChecksum: number, array: Uint8Array<ArrayBuffer>) {
    this.array = array
    this.max = array.buffer.maxByteLength - 4 // dataLen
    writeUint64(array, schemaChecksum, 0)
  }
  id: number
  schema: SchemaTypeDef
  index: number = 8
  array: Uint8Array<ArrayBuffer>
  max: number
  unsafe?: boolean
  overwrite?: boolean
  operation: ModifyOp
  main: Map<PropDef, any> = new Map()
  draining: Promise<void>
  scheduled: boolean
  created: Record<number, number> = {} // <typeId, count
  current: {
    schema?: number
    prop?: number
    main?: number
    id?: number
  } = {}
}
