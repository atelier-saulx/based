import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { PropDef, PropDefEdge, SchemaTypeDef } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { ModifyOp } from '../types.js'
import { append32, write32 } from '../utils.js'

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

function simpleRefs(
  t: PropDef | PropDefEdge,
  ctx: BasedDb['modifyCtx'],
  value: any[],
  res: ModifyState,
): number {
  const buf = ctx.buf
  const len = ctx.len
  let added = 0

  for (const ref of value) {
    let id: number
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
          const $index = ref.$index
          if (typeof $index !== 'number' || $index > 2_147_483_647) {
            modifyError(res, t, value)
            return
          }
          buf[len + added] = 3
          buf.writeUint32LE(id, len + added + 1)
          buf.writeInt32LE($index, len + added + 5)
          added += 9
          continue
        }
      } else {
        modifyError(res, t, value)
        return
      }
    } else {
      id = ref
    }
    buf[len + added] = 0
    buf.writeUint32LE(id, len + added + 1)
    added += 5
  }

  return added
}

export function putReferences(
  t: PropDef,
  ctx: BasedDb['modifyCtx'],
  modifyOp: ModifyOp,
  value: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
  op: 0 | 1, // overwrite or add
) {
  const refLen = 4 * value.length
  const potentialLen = refLen + 1 + 5 + ctx.len + 11
  if (potentialLen > ctx.max) {
    flushBuffer(ctx.db)
  }
  setCursor(ctx, schema, t.prop, res.tmpId, modifyOp)
  ctx.buf[ctx.len++] = modifyOp
  const sizepos = ctx.len
  ctx.len += 4 // reserve for size
  const start = ctx.len
  ctx.buf[ctx.len++] = 3 // put
  // ceil it to nearest 4 for u32 alignment
  ctx.len = (ctx.len + 3) & ~3
  for (const ref of value) {
    if (typeof ref === 'number') {
      append32(ctx, ref)
    } else if (ref instanceof ModifyState) {
      if (ref.error) {
        res.error = ref.error
        return
      }
      append32(ctx, ref.tmpId)
    }
  }
  write32(ctx, ctx.len - start, sizepos)
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
  // putReferences(t, ctx, modifyOp, value, schema, res, op)
  const refLen = 9 * value.length
  const potentialLen = refLen + 1 + 5 + ctx.len + 11 + 4
  if (potentialLen > ctx.max) {
    flushBuffer(ctx.db)
  }
  setCursor(ctx, schema, t.prop, res.tmpId, modifyOp)
  ctx.buf[ctx.len++] = modifyOp
  const sizepos = ctx.len
  ctx.len += 4 // reserve for size
  ctx.buf[ctx.len++] = op // ref op
  append32(ctx, value.length) // ref length
  const size = simpleRefs(t, ctx, value, res)
  ctx.len += size
  write32(ctx, size + 1 + 4, sizepos)
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
  ctx.buf[ctx.len++] = modifyOp
  append32(ctx, refLen + 1)
  ctx.buf[ctx.len++] = 2 // ref op
  for (const ref of value) {
    if (typeof ref === 'number') {
      append32(ctx, ref)
    } else if (ref instanceof ModifyState) {
      if (ref.error) {
        res.error = ref.error
        return
      }
      append32(ctx, ref.tmpId)
    }
  }
}
