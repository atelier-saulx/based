import { BasedDb } from '../../index.js'
import { PropDef, SchemaTypeDef } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
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

const getId = (val) => {
  if (typeof val === 'number') {
    return val
  }
  if (typeof val === 'object') {
    if (val instanceof ModifyState) {
      return val.tmpId
    }
    return val.id instanceof ModifyState ? val.id.tmpId : val.id
  }
}

export function writeReferences(
  t: PropDef,
  db: BasedDb,
  writeKey: 3 | 6,
  value: any,
  schema: SchemaTypeDef,
  res: ModifyState,
  fromCreate: boolean,
) {
  if (typeof value !== 'object') {
    modifyError(res, t, value)
    return
  }

  if (value === null) {
    console.info('DELETE REFERENCES')
    // delete field:
    return
  }

  if (Array.isArray(value)) {
    if (t.edges) {
      overWriteEdgeReferences(t, db, writeKey, value, schema, res, fromCreate)
    } else {
      overWriteSimpleReferences(
        t,
        db,
        writeKey,
        value,
        schema,
        res,
        fromCreate,
        0,
      )
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
      // } else if (key === 'update') {
      //   // ? I think add also just does this?
      //   op = 3
      // } else if (key === 'upsert') {
      //   // ? is this not just add?
      //   op = 4
    } else {
      modifyError(res, t, value)
      return
    }

    overWriteSimpleReferences(t, db, writeKey, val, schema, res, fromCreate, op)
  }
}
