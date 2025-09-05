import { SchemaTypeDef, isPropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { writeSeparate } from './separate.js'
import { writeMainValue } from './main.js'
import { writeIncrement } from './increment.js'

export const writeObject = (
  ctx: Ctx,
  tree: SchemaTypeDef['tree'],
  obj: Record<string, any>,
) => {
  for (const key in obj) {
    const val = obj[key]
    if (val === undefined) {
      continue
    }
    const def = tree[key]
    if (def === undefined) {
      if (ctx.unsafe) {
        continue
      }
      throw [tree, key]
    }
    if (!isPropDef(def)) {
      writeObject(ctx, def, val)
      continue
    }
    try {
      if (def.separate) {
        writeSeparate(ctx, def, val)
      } else if (ctx.overwrite) {
        writeMainValue(ctx, def, val)
      } else if (typeof val === 'object' && val !== null) {
        writeIncrement(ctx, def, val)
      } else {
        ctx.main.set(def, val)
      }
    } catch (e) {
      if (ctx.unsafe && Array.isArray(e)) {
        continue
      }
      throw e
    }
  }
}
