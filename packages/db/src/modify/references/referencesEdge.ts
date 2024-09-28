import { BasedDb } from '../../index.js'
import { PropDef } from '../../schema/types.js'
import { ModifyState, modifyError } from '../ModifyRes.js'
import { ModifyOp } from '../types.js'
import { maybeFlush } from '../utils.js'
import { calculateEdgesSize, writeEdges } from './edge.js'
import { overWriteSimpleReferences } from './simple.js'

export function overWriteEdgeReferences(
  t: PropDef,
  db: BasedDb,
  modifyOp: ModifyOp,
  value: any[],
  res: ModifyState,
  op: 0 | 1 | 2,
) {
  const mod = db.modifyCtx
  mod.buffer[mod.len] = modifyOp
  let refLen = 0

  if (t.edgesTotalLen) {
    refLen = (t.edgesTotalLen + 5) * value.length
  } else {
    refLen = calculateEdgesSize(t, value, res)
  }

  if (refLen === 0) {
    overWriteSimpleReferences(t, db, modifyOp, value, res, op)
    return
  }

  maybeFlush(db, refLen + 10 + 11)

  mod.buffer[mod.len] = modifyOp
  const sizeIndex = mod.len + 1
  mod.buffer[sizeIndex + 4] = op
  mod.len += 6

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
      mod.buffer[mod.len] = 1
      mod.buffer.writeUint32LE(ref.id, mod.len + 1)
      const edgeDataSizeIndex = mod.len + 5
      mod.len += 9
      if (writeEdges(t, ref, db, res)) {
        return
      }
      mod.buffer.writeUint32LE(
        mod.len - edgeDataSizeIndex - 4,
        edgeDataSizeIndex,
      )
    } else {
      mod.buffer[mod.len] = 0
      mod.buffer.writeUint32LE(ref, mod.len + 1)
      mod.len += 5
    }
  }

  mod.buffer.writeUint32LE(mod.len - (sizeIndex + 4), sizeIndex)
}
