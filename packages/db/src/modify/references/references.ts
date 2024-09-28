import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { PropDef, SchemaTypeDef } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
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
  t: PropDef,
  db: BasedDb,
  writeKey: 3 | 6,
  value: any,
  schema: SchemaTypeDef,
  res: ModifyState,
) {
  if (typeof value !== 'object') {
    modifyError(res, t, value)
    return
  }

  if (value === null) {
    if (db.modifyBuffer.len + 11 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, schema, t.prop, res.tmpId, writeKey)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = 11
    db.modifyBuffer.len++
    return
  }

  if (Array.isArray(value)) {
    if (t.edges) {
      overWriteEdgeReferences(t, db, writeKey, value, schema, res, 0)
    } else {
      overWriteSimpleReferences(t, db, writeKey, value, schema, res, 0)
    }
    return
  }

  for (const key in value) {
    const val = value[key]
    let op
    if (key === 'add') {
      op = 1
    } else if (key === 'delete') {
      op = 2
    } else if (key === 'update') {
      op = 3
    } else {
      modifyError(res, t, value)
      return
    }

    if (t.edges) {
      overWriteEdgeReferences(t, db, writeKey, value, schema, res, op)
    } else {
      overWriteSimpleReferences(t, db, writeKey, val, schema, res, op)
    }
  }
}
