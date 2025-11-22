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
import type { LeafDef } from '@based/schema'

export const writeSeparate = (ctx: Ctx, def: LeafDef, val: any) => {
  if (def.type === 'string') {
    writeString(ctx, def, val, 0)
  } else if (def.type === 'text') {
    writeText(ctx, def, val)
  } else if (def.type === 'reference') {
    writeReference(ctx, def, val)
  } else if (def.type === 'references') {
    writeReferences(ctx, def, val)
  } else if (def.type === 'binary') {
    writeBinary(ctx, def, val)
  } else if (def.type === 'alias') {
    writeAlias(ctx, def, val)
  } else if (def.type === 'cardinality') {
    writeCardinality(ctx, def, val)
  } else if (def.type === 'vector' || def.type === 'colvec') {
    writeVector(ctx, def, val)
  } else if (def.type === 'json') {
    writeJson(ctx, def, val)
  }
  markDefaults(ctx, def, val)
}
