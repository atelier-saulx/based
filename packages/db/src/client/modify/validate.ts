import { DbClient } from '../../db.js'
import {
  isValidId,
  type PropDef,
  type PropDefEdge,
} from '../../schema/index.js'

export const validate = (val: any, def: PropDef | PropDefEdge) => {
  const msg = def.validation!(val, def.schema)
  if (msg !== true) {
    throw [def, val, msg]
  }
}

export const validatePayload = (payload: any) => {
  if (typeof payload !== 'object' || payload === null) {
    throw 'Invalid payload'
  }
}

export const validateId = (id: number) => {
  if (!isValidId(id)) {
    throw 'Invalid id'
  }
}

export const getValidSchema = (db: DbClient, type: string) => {
  const schema = db.schemaTypesParsed[type]
  if (schema) {
    return schema
  }
  throw `Unknown type: ${type}. Did you mean on of: ${Object.keys(db.schemaTypesParsed).join(', ')}`
}
