import { SchemaTypeDef, PropDef } from '@based/schema/def'
import { ModifyOp } from '../modify/types.js'

// export type Ctx = {
//   id: number
//   schema: SchemaTypeDef
//   index: number
//   array: Uint8Array<ArrayBuffer>
//   unsafe: boolean
//   overwrite: boolean
//   operation: ModifyOp
//   main: Map<PropDef, any>
//   current: {
//     schema: number
//     prop: number
//     main: number
//     id: number
//   }
// }

export class Ctx {
  constructor(array: Uint8Array<ArrayBuffer>) {
    this.array = array
    this.max = array.buffer.maxByteLength - 4 // dataLen
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
  created: Map<number, number> = new Map() // <type.id, type.lastId>
  current: {
    schema?: number
    prop?: number
    main?: number
    id?: number
  } = {}
}
