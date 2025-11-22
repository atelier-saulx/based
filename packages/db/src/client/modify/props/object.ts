import { Ctx } from '../Ctx.js'
import { writeSeparate } from './separate.js'
import { writeMainValue } from './main.js'
import { writeIncrement } from './increment.js'
import { CREATE } from '../types.js'
import type { LeafDef, BranchDef } from '@based/schema'

const writeProp = (ctx: Ctx, def: LeafDef, val: any) => {
  if ('main' in def) {
    if (ctx.operation === CREATE) {
      writeMainValue(ctx, def, val)
    } else if (typeof val === 'object' && val !== null) {
      writeIncrement(ctx, def, val)
    } else {
      ctx.main.set(def, val)
    }
  } else {
    writeSeparate(ctx, def, val)
  }
}

export const writeObjectSafe = (
  ctx: Ctx,
  tree: BranchDef,
  obj: Record<string, any>,
) => {
  for (const key in obj) {
    const val = obj[key]
    if (val === undefined) {
      continue
    }
    const def = tree.props[key]
    if (def === undefined) {
      throw [tree, val]
    }

    if ('id' in def) {
      writeProp(ctx, def, val)
    } else {
      writeObjectSafe(ctx, def, val)
    }
  }
}

export const writeObjectUnsafe = (
  ctx: Ctx,
  tree: BranchDef,
  obj: Record<string, any>,
) => {
  for (const key in obj) {
    const def = tree.props[key]
    const val = obj[key]
    if (def === undefined || val === undefined) {
      continue
    }
    if ('id' in def) {
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
  def: BranchDef,
  obj: Record<string, any>,
) => {
  if (ctx.unsafe) {
    writeObjectUnsafe(ctx, def, obj)
  } else {
    writeObjectSafe(ctx, def, obj)
  }
}
