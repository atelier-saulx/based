import { SchemaTypeDef, PropDef } from '@based/schema/def'
import { ModifyOp } from '../modify/types.js'

export type Ctx = {
  id: number
  schema: SchemaTypeDef
  index: number
  array: Uint8Array<ArrayBuffer>
  unsafe: boolean
  overwrite: boolean
  operation: ModifyOp
  main: Map<PropDef, any>
  current: {
    schema: number
    prop: number
    main: number
    id: number
  }
}
