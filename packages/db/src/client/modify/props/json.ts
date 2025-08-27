import { Ctx } from '../Ctx.js'
import { PropDef } from '@based/schema/def'
import { writeBinary } from './binary.js'

export const writeJson = (ctx: Ctx, def: PropDef, val: any) => {
  writeBinary(ctx, def, val === null ? null : JSON.stringify(val), true)
}
