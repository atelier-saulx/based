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
import { writeReferences } from './references.js'
import { writeBinary } from './binary.js'
import { writeAlias } from './alias.js'
import { writeCardinality } from './cardinality.js'
import { writeVector } from './vector.js'
import { writeJson } from './json.js'
import { markDefaults } from '../create/mark.js'

export const writeSeparate = (ctx: Ctx, def: PropDef, val: any) => {
  const type = def.typeIndex
  if (type === STRING) {
    writeString(ctx, def, val, 0)
  } else if (type === TEXT) {
    writeText(ctx, def, val)
  } else if (type === REFERENCE) {
    writeReference(ctx, def, val)
  } else if (type === REFERENCES) {
    writeReferences(ctx, def, val)
  } else if (type === BINARY) {
    writeBinary(ctx, def, val)
  } else if (type === ALIAS) {
    writeAlias(ctx, def, val)
  } else if (type === CARDINALITY) {
    writeCardinality(ctx, def, val)
  } else if (type === VECTOR || type === COLVEC) {
    writeVector(ctx, def, val)
  } else if (type === JSON) {
    writeJson(ctx, def, val)
  }
  markDefaults(ctx, def)
}
