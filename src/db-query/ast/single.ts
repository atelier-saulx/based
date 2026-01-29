import { PropDef, TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  pushQueryHeaderSingleReference,
  QueryType,
  writeQueryHeaderSingleReferenceProps as props,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { include } from './include.js'

export const reference = (ast: QueryAst, ctx: Ctx, prop: PropDef) => {
  const headerIndex = pushQueryHeaderSingleReference(ctx.query, {
    op: QueryType.reference,
    typeId: prop.typeDef.id,
    includeSize: 0,
    edgeTypeId: 0,
    edgeSize: 0,
    prop: prop.id,
  })
  const size = include(ast, ctx, prop.typeDef)
  props.includeSize(ctx.query.data, size, headerIndex)
  if (ast.edges) {
    const edges = prop.edges
    if (!edges) {
      throw new Error('Ref does not have edges')
    }
    props.op(ctx.query.data, QueryType.referenceEdge, headerIndex)
    props.edgeTypeId(ctx.query.data, edges.id, headerIndex)
    const size = include(ast.edges, ctx, edges)
    props.edgeSize(ctx.query.data, size, headerIndex)
  }
}
