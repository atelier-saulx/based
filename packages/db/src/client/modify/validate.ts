import { validationMap, type PropDef, type TypeDef } from '@based/schema'
import { DbClient } from '../../index.js'

export const validate = (val: any, def: PropDef) => {
  const msg = def.validation(val, def)
  if (msg !== true) {
    throw [def, val, msg]
  }
}
const maxUint32 = 4_294_967_295
export const validateId = (v: number) => v > 0 && v <= maxUint32
export const validatePayload = (payload: any) => {
  if (typeof payload !== 'object' || payload === null) {
    throw 'Invalid payload'
  }
}

export const getValidSchema = (db: DbClient, type: string): TypeDef => {
  const schema = db.defs[type]
  if (schema) return schema
  throw `Unknown type: ${type}. Did you mean on of: ${Object.keys(db.defs).filter(Number.isNaN).join(', ')}`
}
