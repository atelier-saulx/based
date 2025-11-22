import type { LeafDef } from '@based/schema'
import { Ctx } from '../Ctx.js'
import { writeBinary } from './binary.js'

export const writeJson = (ctx: Ctx, def: LeafDef, val: any) => {
  writeBinary(ctx, def, val === null ? null : JSON.stringify(val), true)
}
