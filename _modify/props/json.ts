import type { PropDef } from '../../../schema/index.js'
import { Ctx } from '../Ctx.js'
import { writeBinary } from './binary.js'

export const writeJson = (ctx: Ctx, def: PropDef, val: any) => {
  writeBinary(ctx, def, val === null ? null : JSON.stringify(val), true)
}
