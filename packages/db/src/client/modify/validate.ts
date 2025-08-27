import { isValidId, PropDef, PropDefEdge } from '@based/schema/def'
import { DbClient } from '../../index.js'

export const validate = (def: PropDef | PropDefEdge, val: any) => {
  if (!def.validation(val, def)) {
    throw [def, val]
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
