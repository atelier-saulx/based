import { ReaderSchemaEnum } from '../../protocol/index.js'
import { PropDef, TypeDef } from '../../schema/defs/index.js'
import {
  pushQueryHeader,
  QueryType,
  ID_PROP,
  writeQueryHeaderProps as props,
  QueryHeaderByteSize,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { include } from './include.js'
import { getIteratorType } from './iteratorType.js'
import { readPropDef, readSchema } from './readSchema.js'

export const defaultMultiple = (ast: QueryAst, ctx: Ctx, typeDef: TypeDef) => {
  const rangeStart = ast.range?.start || 0
  const headerIndex = pushQueryHeader(ctx.query, {
    op: QueryType.default,
    prop: ID_PROP,
    includeSize: 0,
    typeId: typeDef.id,
    offset: rangeStart,
    limit: (ast.range?.end || 1000) + rangeStart,
    sort: false,
    filterSize: 0,
    searchSize: 0,
    iteratorType: getIteratorType(false, false),
    edgeTypeId: 0,
    edgeSize: 0,
    edgeFilterSize: 0,
    size: 0,
  })
  props.includeSize(ctx.query.data, include(ast, ctx, typeDef), headerIndex)
}

export const references = (ast: QueryAst, ctx: Ctx, prop: PropDef) => {
  const rangeStart = ast.range?.start || 0
  const headerIndex = pushQueryHeader(ctx.query, {
    op: QueryType.references,
    prop: prop.id,
    includeSize: 0,
    typeId: prop.typeDef.id,
    offset: rangeStart,
    limit: (ast.range?.end || 100) + rangeStart,
    sort: false,
    filterSize: 0,
    searchSize: 0,
    iteratorType: getIteratorType(false, false),
    edgeTypeId: 0,
    edgeSize: 0,
    edgeFilterSize: 0,
    size: 0, // this is only used for [IDS] handle this differently
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
    props.edgeTypeId(ctx.query.data, edges.id, headerIndex)
    const size = include(
      ast.edges,
      {
        ...ctx,
        readSchema: schema.edges,
      },
      edges,
    )
    props.iteratorType(
      ctx.query.data,
      getIteratorType(true, size > 0),
      headerIndex,
    )
    props.edgeSize(ctx.query.data, size, headerIndex)
  }
}
