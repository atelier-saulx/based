import { SchemaTypeDef, PropDef } from '@based/schema/def'
import { writeUint64 } from '@based/utils'
import { DbSchema } from '../../schema.js'
// TODO finish this
export class Ctx {
  constructor(
    schemaTypesParsed: Record<string, number>,
    schemaHash: number,
    dbCtx: any,
  ) {
    this.dbCtx = dbCtx
    this.schemaHash = schemaHash
    // this.typeIds =
  }
  dirty: Float64Array<ArrayBufferLike> = new Float64Array()
  queue: Uint8Array[] = []
  schemaHash: number = 0
  dbCtx: any
  types: Uint8Array
}
