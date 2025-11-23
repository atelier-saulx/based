import { Ctx } from '../Ctx.js'
import { writeBinaryEdge } from './binary.js'
import { writeStringEdge } from './string.js'
import { writeReferenceEdge } from './reference.js'
import { writeReferencesEdge } from './references.js'
import { writeCardinalityEdge } from './cardinality.js'
import type { PropDefEdge } from '@based/schema'
import { PropType } from '../../../zigTsExports.js'

export const writeSeparateEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (edge.typeIndex === PropType.binary) {
    writeBinaryEdge(ctx, edge, val)
  } else if (edge.typeIndex == PropType.json) {
    writeBinaryEdge(ctx, edge, val === null ? null : JSON.stringify(val))
  } else if (edge.typeIndex === PropType.string) {
    writeStringEdge(ctx, edge, val)
  } else if (edge.typeIndex === PropType.reference) {
    writeReferenceEdge(ctx, edge, val)
  } else if (edge.typeIndex === PropType.references) {
    writeReferencesEdge(ctx, edge, val)
  } else if (edge.typeIndex === PropType.cardinality) {
    writeCardinalityEdge(ctx, edge, val)
  }
}
