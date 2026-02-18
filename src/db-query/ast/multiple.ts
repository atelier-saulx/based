import { ReaderSchemaEnum } from '../../protocol/index.js'
import { PropDef, TypeDef } from '../../schema/defs/index.js'
import {
  pushQueryHeader,
  QueryType,
  ID_PROP,
  writeQueryHeaderProps as props,
  QueryIteratorType,
  readQueryHeader,
  pushSortHeader,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { filter } from './filter/filter.js'
import { include } from './include.js'
import { getIteratorType } from './iteratorType.js'
import { readPropDef, readSchema } from './readSchema.js'
import { isAggregateAst, pushAggregatesQuery } from './aggregates.js'
import { sort } from './sort.js'

export const defaultMultiple = (ast: QueryAst, ctx: Ctx, typeDef: TypeDef) => {
  const rangeStart = ast.range?.start || 0

  if (isAggregateAst(ast)) {
    pushAggregatesQuery(ast, ctx, typeDef)
    return
  }

  const headerIndex = pushQueryHeader(ctx.query, {
    op: QueryType.default,
    prop: ID_PROP,
    includeSize: 0,
    typeId: typeDef.id,
    offset: rangeStart,
    limit: (ast.range?.end || 1000) + rangeStart,
    sort: !!ast.sort,
    filterSize: 0,
    // Lets remove all this from the header and make specific ones
    searchSize: 0,
    iteratorType: QueryIteratorType.default,
    edgeTypeId: 0,
    edgeSize: 0,
    edgeFilterSize: 0,
    size: 0,
  })

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

// ADD IDS

export const references = (ast: QueryAst, ctx: Ctx, prop: PropDef) => {
  const rangeStart = ast.range?.start || 0
  const headerIndex = pushQueryHeader(ctx.query, {
    op: QueryType.references,
    prop: prop.id,
    includeSize: 0,
    typeId: prop.ref!.id,
    offset: rangeStart,
    limit: (ast.range?.end || 100) + rangeStart,
    sort: !!ast.sort,
    filterSize: 0,
    searchSize: 0,
    iteratorType: QueryIteratorType.default,
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

  if (ast.sort) {
    pushSortHeader(ctx.query, sort(ast, ctx, prop.ref!, prop))
  }

  if (ast.filter) {
    const filterSize = filter(ast.filter, ctx, prop.ref!)
    props.filterSize(ctx.query.data, filterSize, headerIndex)
  }

  const size = include(
    ast,
    {
      ...ctx,
      readSchema: schema,
    },
    prop.ref!,
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
    props.edgeSize(ctx.query.data, size, headerIndex)
  }

  props.iteratorType(
    ctx.query.data,
    getIteratorType(readQueryHeader(ctx.query.data, headerIndex), ast),
    headerIndex,
  )
}
