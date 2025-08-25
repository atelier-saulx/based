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
import { Ctx } from '../Ctx.js'
import { writeReference } from './reference.js'
import { writeString } from './string.js'
import { writeText } from './text.js'

export const writeSeparate = (ctx: Ctx, def: PropDef, val: any) => {
  const type = def.typeIndex
  if (type === STRING) {
    writeString(ctx, def, val, 0)
  } else if (type === TEXT) {
    writeText(ctx, def, val)
  } else if (type === REFERENCE) {
    writeReference(ctx, def, val)
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
