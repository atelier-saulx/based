import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { PropDef, PropDefEdge, SchemaTypeDef } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { ModifyOp } from '../types.js'
import {
  alignU32,
  appendU32,
  appendU8,
  reserveU32,
  writeU32,
} from '../utils.js'

const updateRemainingReferences = (
  t: PropDef,
  ctx: BasedDb['modifyCtx'],
  modifyOp: ModifyOp,
  value: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
  op: 0 | 1,
  i: number,
) => {
  const remaining = value.length - i

  setCursor(ctx, schema, t.prop, res.tmpId, modifyOp)
  appendU8(ctx, modifyOp)

  const sizepos = reserveU32(ctx)

  appendU8(ctx, i === 0 ? op : 1) // if it just did a PUT, it should ADD not overwrite the remaining
  appendU32(ctx, remaining) // ref length

  for (; i < value.length; i++) {
    const ref = value[i]
    let id: number
    let index: number

    if (typeof ref === 'object') {
      if (ref instanceof ModifyState) {
        if (ref.error) {
          res.error = ref.error
          return
        }
        id = ref.tmpId
      } else if (ref.id instanceof ModifyState) {
        if (ref.id.error) {
          res.error = ref.id.error
          return
        }
        id = ref.id.tmpId
        index = ref.$index
      } else if (ref.id > 0) {
        id = ref.id
        index = ref.$index
      } else {
        modifyError(res, t, value)
        return
      }
    } else if (ref > 0) {
      id = ref
    } else {
      modifyError(res, t, value)
      return
    }

    if (index === undefined) {
      appendU8(ctx, 0)
      appendU32(ctx, id)
    } else if (index >= 0) {
      appendU8(ctx, 3)
      appendU32(ctx, id)
      appendU32(ctx, index)
    } else {
      modifyError(res, t, value)
      return
    }
  }

  writeU32(ctx, ctx.len - sizepos - 4, sizepos)
}

export function overWriteSimpleReferences(
  t: PropDef,
  ctx: BasedDb['modifyCtx'],
  modifyOp: ModifyOp,
  value: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
  op: 0 | 1, // overwrite or add
) {
  const refLen = 9 * value.length
  const potentialLen = refLen + 1 + 5 + ctx.len + 11 + 4
  if (potentialLen > ctx.max) {
    flushBuffer(ctx.db)
  }
  setCursor(ctx, schema, t.prop, res.tmpId, modifyOp)
  const initpos = ctx.len

  appendU8(ctx, modifyOp)
  appendU32(ctx, refLen + 1)
  appendU8(ctx, op === 0 ? 3 : 4)
  alignU32(ctx)

  let i = 0
  for (; i < value.length; i++) {
    const ref = value[i]
    if (typeof ref === 'number') {
      appendU32(ctx, ref)
    } else if (ref instanceof ModifyState) {
      if (ref.error) {
        res.error = ref.error
        return
      }
      appendU32(ctx, ref.tmpId)
    } else {
      break
    }
  }

  if (i === value.length) {
    return
  }

  if (i < 2) {
    i = 0
    ctx.len = initpos
  }

  updateRemainingReferences(t, ctx, modifyOp, value, schema, res, op, i)
}

export function deleteRefs(
  t: PropDef,
  ctx: BasedDb['modifyCtx'],
  modifyOp: ModifyOp,
  value: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
) {
  const refLen = 4 * value.length
  const potentialLen = refLen + 1 + 5 + ctx.len + 11
  if (potentialLen > ctx.max) {
    flushBuffer(ctx.db)
  }

  setCursor(ctx, schema, t.prop, res.tmpId, modifyOp)
  appendU8(ctx, modifyOp)
  appendU32(ctx, refLen + 1)
  appendU8(ctx, 2)

  for (const ref of value) {
    if (typeof ref === 'number') {
      appendU32(ctx, ref)
    } else if (ref instanceof ModifyState) {
      if (ref.error) {
        res.error = ref.error
        return
      }
      appendU32(ctx, ref.tmpId)
    }
  }
}
