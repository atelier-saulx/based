import { Ctx } from '../Ctx.ts'
import type { PropDef } from '@based/schema/def'
import { writeBinary } from './binary.ts'

export const writeJson = (ctx: Ctx, def: PropDef, val: any) => {
  writeBinary(ctx, def, val === null ? null : JSON.stringify(val), true)
}
