import { Ctx } from '../Ctx.js'
import { writeSeparate } from './separate.js'
import { writeMainValue } from './main.js'
import { writeIncrement } from './increment.js'
import { ModOp } from '../../../zigTsExports.js'
import {
  isPropDef,
  type PropDef,
  type SchemaTypeDef,
} from '../../../schema/index.js'

const writeProp = (ctx: Ctx, def: PropDef, val: any) => {
  if (def.separate) {
    writeSeparate(ctx, def, val)
  } else if (ctx.operation === ModOp.createProp) {
    writeMainValue(ctx, def, val)
  } else if (typeof val === 'object' && val !== null) {
    writeIncrement(ctx, def, val)
  } else {
    ctx.main.set(def, val)
  }
}

export const writeObjectSafe = (
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
      throw [tree, val]
    }
    if (isPropDef(def)) {
      writeProp(ctx, def, val)
    } else {
      writeObjectSafe(ctx, def, val)
    }
  }
}

export const writeObjectUnsafe = (
  ctx: Ctx,
  tree: SchemaTypeDef['tree'],
  obj: Record<string, any>,
) => {
  for (const key in obj) {
    const def = tree[key]
    const val = obj[key]
    if (def === undefined || val === undefined) {
      continue
    }
    if (isPropDef(def)) {
      const index = ctx.index
      try {
        writeProp(ctx, def, val)
      } catch (e) {
        if (Array.isArray(e)) {
          ctx.index = index
          continue
        }
        throw e
      }
    } else {
      writeObjectUnsafe(ctx, def, val)
    }
  }
}

export const writeObject = (
  ctx: Ctx,
  tree: SchemaTypeDef['tree'],
  obj: Record<string, any>,
) => {
  if (ctx.unsafe) {
    writeObjectUnsafe(ctx, tree, obj)
  } else {
    writeObjectSafe(ctx, tree, obj)
  }
}
