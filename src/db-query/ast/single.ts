import { ReaderSchemaEnum } from '../../protocol/index.js'
import { PropDef } from '../../schema/defs/index.js'
import {
  pushQueryHeaderSingleReference,
  QueryType,
  writeQueryHeaderSingleReferenceProps as props,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { include } from './include.js'
import { readPropDef, readSchema } from './readSchema.js'

export const reference = (ast: QueryAst, ctx: Ctx, prop: PropDef) => {
  const headerIndex = pushQueryHeaderSingleReference(ctx.query, {
    op: QueryType.reference,
    typeId: prop.typeDef.id,
    includeSize: 0,
    edgeTypeId: 0,
    edgeSize: 0,
    prop: prop.id,
  })

  const schema = readSchema()
  ctx.readSchema.refs[prop.id] = {
    schema,
    prop: readPropDef(prop, ctx.locales, ast.include),
  }
  const size = include(
    ast,
    {
      ...ctx,
      readSchema: schema,
    },
    prop.typeDef,
  )
  props.includeSize(ctx.query.data, size, headerIndex)

  if (ast.edges) {
    const edges = prop.edges
    if (!edges) {
      throw new Error('Ref does not have edges')
    }
    schema.edges = readSchema(ReaderSchemaEnum.edge)
    props.op(ctx.query.data, QueryType.referenceEdge, headerIndex)
    props.edgeTypeId(ctx.query.data, edges.id, headerIndex)
    const size = include(
      ast.edges,
      {
        ...ctx,
        readSchema: schema.edges,
      },
      edges,
    )
    props.edgeSize(ctx.query.data, size, headerIndex)
  }
}
