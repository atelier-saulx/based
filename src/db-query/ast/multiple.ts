import { ReadSchemaEnum } from '../../protocol/index.js'
import { PropDef, TypeDef } from '../../schema/defs/index.js'
import {
  pushQueryHeader,
  QueryType,
  ID_PROP,
  writeQueryHeaderProps as props,
  QueryIteratorType,
  readQueryHeader,
  pushSortHeader,
  FilterType,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { filter } from './filter/filter.js'
import { include } from './include/include.js'
import { getIteratorType } from './iteratorType.js'
import { readPropDef, readSchema } from './readSchema.js'
import { isAggregateAst, pushAggregatesQuery } from './aggregates.js'
import { sort } from './sort.js'

export const defaultMultiple = (ast: QueryAst, ctx: Ctx, typeDef: TypeDef) => {
  const rangeStart = ast.range?.start || 0
  const limit = (ast.range?.end || 1000) - rangeStart

  if (isAggregateAst(ast, typeDef)) {
    pushAggregatesQuery(ast, ctx, typeDef)
    return
  }

  const headerIndex = pushQueryHeader(ctx.query, {
    op: QueryType.default,
    prop: ID_PROP,
    includeSize: 0,
    typeId: typeDef.id,
    offset: rangeStart,
    limit,
    sort: !!ast.sort,
    filterSize: 0,
    // Lets remove all this from the header and make specific ones
    searchSize: 0,
    iteratorType: QueryIteratorType.default,
    edgeTypeId: 0,
    edgeSize: 0,
    size: 0,
  })

  if (Array.isArray(ast.target)) {
    // and numbers...
    props.op(ctx.query.data, QueryType.ids, headerIndex)
    const start = ctx.query.length
    for (const id of ast.target) {
      ctx.query.pushUint32(id)
    }
    props.size(ctx.query.data, ctx.query.length - start, headerIndex)
  }

  if (ast.sort) {
    pushSortHeader(ctx.query, sort(ast, ctx, typeDef))
  }

  if (ast.filter) {
    const filterSize = filter(ast.filter, ctx, typeDef)
    props.filterSize(ctx.query.data, filterSize, headerIndex)
  }

  props.includeSize(ctx.query.data, include(ast, ctx, typeDef), headerIndex)
  props.iteratorType(
    ctx.query.data,
    getIteratorType(readQueryHeader(ctx.query.data, headerIndex), ast),
    headerIndex,
  )
}

export const references = (ast: QueryAst, ctx: Ctx, prop: PropDef) => {
  const schema = readSchema()
  ctx.readSchema.refs[prop.id] = {
    schema,
    prop: readPropDef(prop, ctx),
  }

  if (isAggregateAst(ast, prop.ref)) {
    const prevLength = ctx.query.length
    pushAggregatesQuery(ast, { ...ctx, readSchema: schema }, prop.ref!, prop)
    return ctx.query.length - prevLength
  }

  const edgeTypeId = prop.edges?.id ?? 0

  const rangeStart = ast.range?.start || 0
  const limit = (ast.range?.end || 100) - rangeStart

  const headerIndex = pushQueryHeader(ctx.query, {
    op: edgeTypeId ? QueryType.referencesEdge : QueryType.references,
    prop: prop.id,
    includeSize: 0,
    typeId: prop.ref!.id,
    offset: rangeStart,
    limit,
    sort: !!ast.sort,
    filterSize: 0,
    searchSize: 0,
    iteratorType: QueryIteratorType.default,
    edgeTypeId,
    edgeSize: 0,
    size: 0, // this is only used for [IDS] handle this differently
  })

  if (ast.sort) {
    pushSortHeader(ctx.query, sort(ast, ctx, prop.ref!, prop))
  }

  if (ast.filter) {
    const filterSize = filter(ast.filter, ctx, prop.ref!, prop.edges)
    props.filterSize(ctx.query.data, filterSize, headerIndex)
  }

  const size = include(
    ast,
    {
      ...ctx,
      readSchema: schema,
    },
    prop.ref!,
    prop,
  )

  props.includeSize(ctx.query.data, size, headerIndex)

  if (ast.edges) {
    const edges = prop.edges
    if (!edges) {
      throw new Error('Ref does not have edges')
    }
    schema.edges = readSchema(ReadSchemaEnum.edge)
    props.op(ctx.query.data, QueryType.referencesEdgeInclude, headerIndex)
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

  props.iteratorType(
    ctx.query.data,
    getIteratorType(readQueryHeader(ctx.query.data, headerIndex), ast),
    headerIndex,
  )
}
