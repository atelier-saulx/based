import {
  PropDefEdge,
  BINARY,
  STRING,
  REFERENCE,
  REFERENCES,
  CARDINALITY,
} from '@based/schema/def'
import { Ctx } from '../../Ctx.js'
import { writeBinaryEdge } from './binary.js'
import { writeStringEdge } from './string.js'
import { writeReferenceEdge } from './reference.js'
import { writeReferencesEdge } from './references.js'
import { writeCardinalityEdge } from './cardinality.js'

export const writeSeparateEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (edge.typeIndex === BINARY) {
    writeBinaryEdge(ctx, edge, val)
  } else if (edge.typeIndex === STRING) {
    writeStringEdge(ctx, edge, val)
  } else if (edge.typeIndex === REFERENCE) {
    writeReferenceEdge(ctx, edge, val)
  } else if (edge.typeIndex === REFERENCES) {
    writeReferencesEdge(ctx, edge, val)
  } else if (edge.typeIndex === CARDINALITY) {
    writeCardinalityEdge(ctx, edge, val)
  }
}
