import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { PropDef, SchemaTypeDef } from '../../schema/types.js'
import { ModifyState, modifyError } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { ModifyOp } from '../types.js'
import { append32, write32 } from '../utils.js'
import { calculateEdgesSize, writeEdges } from './edge.js'
import { overWriteSimpleReferences } from './simple.js'

export function overWriteEdgeReferences(
  t: PropDef,
  ctx: BasedDb['modifyCtx'],
  modifyOp: ModifyOp,
  value: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
  op: 0 | 1 | 2,
) {
  ctx.buf[ctx.len] = modifyOp
  let refLen = 0

  if (t.edgesTotalLen) {
    refLen = (t.edgesTotalLen + 5) * value.length
  } else {
    refLen = calculateEdgesSize(t, value, res)
  }

  if (refLen === 0) {
    overWriteSimpleReferences(
      t,
      ctx,
      modifyOp,
      value,
      schema,
      res,
      op, // overwrite
    )
    return
  }

  if (refLen + 10 + ctx.len + 11 + 4 > ctx.max) {
    flushBuffer(ctx.db)
  }

  setCursor(ctx, schema, t.prop, res.tmpId, modifyOp)

  ctx.buf[ctx.len++] = modifyOp
  const sizepos = ctx.len
  ctx.len += 4 // reserve for size
  const start = ctx.len
  ctx.buf[ctx.len++] = op // ref op
  append32(ctx, value.length) // ref length
  for (let i = 0; i < value.length; i++) {
    let ref = value[i]
    if (typeof ref !== 'number') {
      if (ref instanceof ModifyState) {
        if (ref.error) {
          res.error = ref.error
          return
        }
        ref = ref.tmpId
      } else if (typeof ref !== 'object') {
        modifyError(res, t, value)
        return
      }
    }
    if (typeof ref === 'object') {
      ctx.buf[ctx.len++] = 1
      append32(ctx, ref.id)
      const sizepos = ctx.len
      ctx.len += 4 // reserve for size

      // ctx.buf.writeUint32LE(ref.id, ctx.len + 1)
      // const edgeDataSizeIndex = ctx.len + 5
      // ctx.len += 9
      const start = ctx.len
      if (writeEdges(t, ref, ctx, res)) {
        return
      }
      write32(ctx, ctx.len - start, sizepos)
      // ctx.buf.writeUint32LE(ctx.len - edgeDataSizeIndex - 4, edgeDataSizeIndex)
    } else {
      ctx.buf[ctx.len++] = 0
      append32(ctx, ref)
      // ctx.buf.writeUint32LE(ref, ctx.len + 1)
    }
  }

  write32(ctx, ctx.len - start, sizepos)

  // ctx.buf.writeUint32LE(ctx.len - (sizeIndex + 4), sizeIndex)
}
