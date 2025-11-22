import { isValidId, type PropDef, type TypeDef } from '@based/schema'
import { DbClient } from '../../index.js'

export const validate = (val: any, def: PropDef) => {
  const msg = def.validation(val, def)
  if (msg !== true) {
    throw [def, val, msg]
  }
}
export const validateId = (v: number) => {
  if (!isValidId(v)) {
    throw 'Invalid id'
  }
}
export const validatePayload = (payload: any) => {
  if (typeof payload !== 'object' || payload === null) {
    throw 'Invalid payload'
  }
}

export const getValidSchema = (db: DbClient, type: string): TypeDef => {
  const schema = db.defs.byName[type]
  if (schema) return schema
  throw `Unknown type: ${type}. Did you mean on of: ${Object.keys(db.defs.byName).filter(Number.isNaN).join(', ')}`
}
