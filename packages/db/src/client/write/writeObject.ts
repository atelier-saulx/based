import { SchemaTypeDef, isPropDef } from '@based/schema/def'
import { Ctx } from './Ctx.js'
import { writeSeperate } from './writeSeperate.js'
import { writeMain } from './writeMain.js'
import { writeIncrement } from './writeIncrement.js'

export const writeObject = (
  ctx: Ctx,
  obj: Record<string, any>,
  tree: SchemaTypeDef['tree'],
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
      writeObject(ctx, obj[key], def)
      continue
    }
    if (def.separate) {
      writeSeperate(ctx, def, val)
      continue
    }
    if (ctx.overwrite) {
      writeMain(ctx, def, val)
      continue
    }
    if (typeof val === 'object' && val !== null) {
      writeIncrement(ctx, def, val)
      continue
    }
    ctx.main.set(def, val)
  }
}
