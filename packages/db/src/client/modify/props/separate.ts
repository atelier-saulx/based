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
import { Ctx } from '../Ctx.ts'
import { writeReference } from './reference.ts'
import { writeString } from './string.ts'
import { writeText } from './text.ts'
import { writeReferences } from './references.ts'
import { writeBinary } from './binary.ts'
import { writeAlias } from './alias.ts'
import { writeCardinality } from './cardinality.ts'
import { writeVector } from './vector.ts'
import { writeJson } from './json.ts'
import { markDefaults } from '../create/mark.ts'

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
  markDefaults(ctx, def, val)
}
