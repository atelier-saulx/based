import {
  PropDefEdge,
  BINARY,
  STRING,
  REFERENCE,
  REFERENCES,
  CARDINALITY,
  JSON as JSONProp,
} from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { writeBinaryEdge } from './binary.ts'
import { writeStringEdge } from './string.ts'
import { writeReferenceEdge } from './reference.ts'
import { writeReferencesEdge } from './references.ts'
import { writeCardinalityEdge } from './cardinality.ts'

export const writeSeparateEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (edge.typeIndex === BINARY) {
    writeBinaryEdge(ctx, edge, val)
  } else if (edge.typeIndex == JSONProp) {
    writeBinaryEdge(ctx, edge, val === null ? null : JSON.stringify(val))
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
