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
import { PropType } from '../../../zigTsExports.js'
import type { PropDef } from '../../../schema/index.js'

export const writeSeparate = (ctx: Ctx, def: PropDef, val: any) => {
  const type = def.typeIndex
  if (type === PropType.string) {
    writeString(ctx, def, val, 0)
  } else if (type === PropType.text) {
    writeText(ctx, def, val)
  } else if (type === PropType.reference) {
    writeReference(ctx, def, val)
  } else if (type === PropType.references) {
    writeReferences(ctx, def, val)
  } else if (type === PropType.binary) {
    writeBinary(ctx, def, val)
  } else if (type === PropType.alias) {
    writeAlias(ctx, def, val)
  } else if (type === PropType.cardinality) {
    writeCardinality(ctx, def, val)
  } else if (type === PropType.vector || type === PropType.colVec) {
    writeVector(ctx, def, val)
  } else if (type === PropType.json) {
    writeJson(ctx, def, val)
  }
}
