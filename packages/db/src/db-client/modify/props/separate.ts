import { Ctx } from '../Ctx.js'
import { writeReference } from './reference.js'
import { writeText } from './text.js'
import { writeReferences } from './references.js'
import { writeCardinality } from './cardinality.js'
import { writeVector } from './vector.js'
import { writeJson } from './json.js'
import { markDefaults } from '../create/mark.js'
import { PropType } from '../../../zigTsExports.js'
import type { PropDef } from '../../../schema/index.js'

export const writeSeparate = (ctx: Ctx, def: PropDef, val: any) => {
  const type = def.typeIndex
  if (type === PropType.text) {
    writeText(ctx, def, val)
  } else if (type === PropType.reference) {
    writeReference(ctx, def, val)
  } else if (type === PropType.references) {
    writeReferences(ctx, def, val)
  } else if (type === PropType.cardinality) {
    writeCardinality(ctx, def, val)
  } else if (type === PropType.colVec) {
    writeVector(ctx, def, val)
  } else if (type === PropType.json) {
    writeJson(ctx, def, val)
  }
  markDefaults(ctx, def, val)
}
