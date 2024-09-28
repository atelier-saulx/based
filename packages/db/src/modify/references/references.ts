import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { PropDef, SchemaTypeDef } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import {
  DELETE_FIELD,
  ModifyOp,
  REFS_ADD,
  REFS_DELETE,
  REFS_PUT,
  REFS_UPDATE,
} from '../types.js'
import { maybeFlush } from '../utils.js'
import { overWriteEdgeReferences } from './referencesEdge.js'
import { overWriteSimpleReferences } from './simple.js'

// export
export type RefModifyOpts = {
  id?: number | ModifyState
  $index?: number
} & Record<`$${string}`, any>

export type RefModify = ModifyState | RefModifyOpts | number

export type Refs =
  | RefModify[]
  | {
      add?: RefModify[] | RefModify
      update?: RefModify[] | RefModify
      delete?: RefModify[] | RefModify
      upsert: RefModify[] | RefModify
    }

export function writeReferences(
  value: any,
  db: BasedDb,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
) {
  if (typeof value !== 'object') {
    modifyError(res, t, value)
  } else if (value === null) {
    const mod = db.modifyCtx
    maybeFlush(db, 11)
    mod.buffer[mod.len] = DELETE_FIELD
    mod.len++
  } else if (Array.isArray(value)) {
    if (t.edges) {
      overWriteEdgeReferences(t, db, modifyOp, value, res, REFS_PUT)
    } else {
      overWriteSimpleReferences(t, db, modifyOp, value, res, REFS_PUT)
    }
  } else {
    for (const key in value) {
      const val = value[key]
      let op
      if (key === 'add') {
        op = REFS_ADD
      } else if (key === 'delete') {
        op = REFS_DELETE
      } else if (key === 'update') {
        op = REFS_UPDATE
      } else {
        modifyError(res, t, value)
        return
      }
      if (t.edges) {
        overWriteEdgeReferences(t, db, modifyOp, value, res, op)
      } else {
        overWriteSimpleReferences(t, db, modifyOp, val, res, op)
      }
    }
  }
}
