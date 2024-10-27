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
  reserveSizeU32,
  commitReservedSizeU32,
} from '../utils.js'

export function simpleRefsPacked(
  t: PropDefEdge,
  ctx: BasedDb['modifyCtx'],
  value: any[],
  res: ModifyState,
) {
  for (let i = 0; i < value.length; i++) {
    let ref = value[i]
    let id: number
    let $index: number

    if (typeof ref !== 'number') {
      if (ref instanceof ModifyState) {
        if (ref.error) {
          res.error = ref.error
          return
        }
        id = ref.tmpId
      } else if (typeof ref === 'object' && 'id' in ref) {
        id = ref.id
        if ('$index' in ref) {
          $index = ref.$index
        }
      } else {
        modifyError(res, t, value)
        return
      }
    } else {
      id = ref
    }

    ctx.buf.writeUint32LE(id, i * 4 + ctx.len)
  }
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
  let i = 0

  const refLen = 4 * value.length
  const potentialLen = refLen + 1 + 5 + ctx.len + 11
  if (potentialLen > ctx.max) {
    flushBuffer(ctx.db)
  }

  setCursor(ctx, schema, t.prop, res.tmpId, modifyOp)

  const initpos = ctx.len

  appendU8(ctx, modifyOp)
  appendU32(ctx, refLen + 1)
  appendU8(ctx, op === 0 ? 3 : 4)
  alignU32(ctx)

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

  const remaining = value.length - i
  const refLen2 = 9 * remaining
  const potentialLen2 = refLen2 + 1 + 5 + ctx.len + 11 + 4

  if (potentialLen2 > ctx.max) {
    flushBuffer(ctx.db)
  }

  setCursor(ctx, schema, t.prop, res.tmpId, modifyOp)
  appendU8(ctx, modifyOp)
  reserveSizeU32(ctx)
  appendU8(ctx, op)
  appendU32(ctx, remaining) // ref length

  for (; i < value.length; i++) {
    const ref = value[i]
    let id: number
    let index: number

    if (typeof ref === 'object') {
      if (ref === null) {
        modifyError(res, t, value)
        return
      }
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

  commitReservedSizeU32(ctx)
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
