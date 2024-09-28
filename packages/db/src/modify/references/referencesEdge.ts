import { BasedDb } from '../../index.js'
import { PropDef } from '../../schema/types.js'
import { ModifyState, modifyError } from '../ModifyRes.js'
import { ModifyOp } from '../types.js'
import { maybeFlush } from '../utils.js'
import { calculateEdgesSize, writeEdges } from './edge.js'
import { overWriteSimpleReferences } from './simple.js'

export function overWriteEdgeReferences(
  propDef: PropDef,
  db: BasedDb,
  modifyOp: ModifyOp,
  value: any[],
  res: ModifyState,
  op: 0 | 1 | 2,
) {
  const ctx = db.modifyCtx
  const buf = ctx.buffer
  buf[ctx.len] = modifyOp
  let refLen = 0

  if (propDef.edgesTotalLen) {
    refLen = (propDef.edgesTotalLen + 5) * value.length
  } else {
    refLen = calculateEdgesSize(propDef, value, res)
  }

  if (refLen === 0) {
    overWriteSimpleReferences(propDef, db, modifyOp, value, res, op)
    return
  }

  maybeFlush(db, refLen + 10 + 11)

  buf[ctx.len] = modifyOp
  const sizeIndex = ctx.len + 1
  buf[sizeIndex + 4] = op
  ctx.len += 6

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
        modifyError(res, propDef, value)
        return
      }
    }
    if (typeof ref === 'object') {
      buf[ctx.len] = 1
      buf.writeUint32LE(ref.id, ctx.len + 1)
      const edgeDataSizeIndex = ctx.len + 5
      ctx.len += 9
      if (writeEdges(propDef, ref, db, res)) {
        return
      }
      buf.writeUint32LE(ctx.len - edgeDataSizeIndex - 4, edgeDataSizeIndex)
    } else {
      buf[ctx.len] = 0
      buf.writeUint32LE(ref, ctx.len + 1)
      ctx.len += 5
    }
  }

  ctx.buffer.writeUint32LE(ctx.len - (sizeIndex + 4), sizeIndex)
}
