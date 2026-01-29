import { PropDef, TypeDef } from '../../schema/defs/index.js'
import {
  pushQueryHeader,
  QueryType,
  ID_PROP,
  writeQueryHeaderProps as props,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { include } from './include.js'
import { getIteratorType } from './iteratorType.js'

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
    iteratorType: getIteratorType(),
    edgeTypeId: 0,
    edgeSize: 0,
    edgeFilterSize: 0,
    size: 0,
  })
  props.includeSize(ctx.query.data, include(ast, ctx, typeDef), headerIndex)
}

export const references = (ast: QueryAst, ctx: Ctx, prop: PropDef) => {}
