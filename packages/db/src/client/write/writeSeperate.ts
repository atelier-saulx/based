import {
  PropDef,
  STRING,
  TEXT,
  REFERENCE,
  REFERENCES,
  BINARY,
  ALIAS,
  CARDINALITY,
  VECTOR,
  COLVEC,
  JSON,
} from '@based/schema/def'
import { Ctx } from './Ctx.js'

export const writeSeperate = (ctx: Ctx, def: PropDef, val: any) => {
  const type = def.typeIndex
  if (type === STRING) {
    // writeString(0, val, ctx, schema, def, res.tmpId, mod)
  } else if (type === TEXT) {
    // writeText(val, ctx, schema, def, res, res.tmpId, mod)
  } else if (type === REFERENCE) {
    // writeReference(val, ctx, schema, def, res, mod)
  } else if (type === REFERENCES) {
    // writeReferences(val, ctx, schema, def, res, mod)
  } else if (type === BINARY) {
    // writeBinary(val, ctx, schema, def, res.tmpId, mod)
  } else if (type === ALIAS) {
    // writeAlias(val, ctx, schema, def, res.tmpId, mod)
  } else if (type === CARDINALITY) {
    // writeHll(val, ctx, schema, def, res.tmpId, mod)
  } else if (type === VECTOR || type === COLVEC) {
    // writeVector(val, ctx, schema, def, res.tmpId, mod)
  } else if (type === JSON) {
    // writeJson(val, ctx, schema, def, res.tmpId, mod)
  }
}
