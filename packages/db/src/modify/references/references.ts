import { BasedDb } from '../../index.js'
import { PropDef, SchemaTypeDef } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { overWriteEdgeReferences } from './edges.js'
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
  fromCreate: boolean,
) {
  if (value === null) {
    console.info('DELETE REFERENCES')
    // delete field:
    return
  }

  if (Array.isArray(value)) {
    if (t.edges) {
      overWriteEdgeReferences(t, db, writeKey, value, schema, res, fromCreate)
    } else {
      overWriteSimpleReferences(t, db, writeKey, value, schema, res, fromCreate)
    }
    return
  }

  // SPECIAL TYPES
  // handle these as separate commands
  // add:
  // update:
  // delete:
  // upsert:
}
