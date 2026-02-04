import { TypeDef } from '../../schema/defs/index.js'
import {
  QueryType,
  QueryIteratorType,
  AggFunction,
  AggHeaderByteSize,
  createAggHeader,
  createAggProp,
  AggPropByteSize,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { filter } from './filter/filter.js'
import { aggregateTypeMap } from '../../db-client/query/aggregates/types.js'
import { readPropDef } from './readSchema.js'
import { truncate } from 'node:fs'

export const pushAggregatesQuery = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
) => {
  const headerStartPos = ctx.query.length
  ctx.query.length += AggHeaderByteSize
  ctx.readSchema.aggregate = {
    aggregates: [],
    totalResultsSize: 0,
  }

  let filterSize = 0
  if (ast.filter) {
    filterSize = filter(ast.filter, ctx, typeDef)
  }

  const sizes = {
    result: 0,
    accumulator: 0,
  }

  const hasGroupBy = false // TODO : later

  pushAggregates(ast, ctx, typeDef, sizes)

  const headerBuffer = buildAggregateHeader(
    ast,
    typeDef,
    filterSize,
    hasGroupBy,
    sizes,
  )
  ctx.query.data.set(headerBuffer, headerStartPos)
}

const isRootCountOnly = (ast: QueryAst) => {
  return !!(
    ast.count &&
    !ast.sum &&
    !ast.avg &&
    !ast.min &&
    !ast.max &&
    !ast.stddev &&
    !ast.var &&
    !ast.harmonicMean &&
    !ast.cardinality
  )
}

const buildAggregateHeader = (
  ast: QueryAst,
  typeDef: TypeDef,
  filterSize: number,
  hasGroupBy: boolean,
  sizes: { result: number; accumulator: number },
) => {
  const rangeStart = ast.range?.start || 0

  const commonHeader = {
    offset: rangeStart,
    filterSize,
    hasGroupBy,
    resultsSize: sizes.result,
    accumulatorSize: sizes.accumulator,
    isSamplingSet: checkSamplingMode(ast),
  }

  const isCountOnly = isRootCountOnly(ast)
  const op = isCountOnly ? QueryType.aggregatesCount : QueryType.aggregates

  let headerBuffer: Uint8Array

  // TODO: references

  headerBuffer = createAggHeader({
    ...commonHeader,
    op,
    typeId: typeDef.id,
    limit: (ast.range?.end || 1000) + rangeStart,
    iteratorType:
      filterSize === 0
        ? QueryIteratorType.aggregate
        : QueryIteratorType.aggregateFilter, // TODO : later
  })
  return headerBuffer
}

const pushAggregates = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
  sizes: { result: number; accumulator: number },
) => {
  // this for loop may be temporary
  // need to support repeated funcs or keep it very strict
  // adding a validation to force only distinct funcs with props[]
  const aggs = [
    { key: 'count', fn: AggFunction.count },
    { key: 'sum', fn: AggFunction.sum },
    { key: 'avg', fn: AggFunction.avg },
    { key: 'min', fn: AggFunction.min },
    { key: 'max', fn: AggFunction.max },
    { key: 'cardinality', fn: AggFunction.cardinality },
    { key: 'stddev', fn: AggFunction.stddev },
    { key: 'var', fn: AggFunction.variance },
    { key: 'harmonicMean', fn: AggFunction.hmean },
  ]

  for (const { key, fn } of aggs) {
    const data = ast[key]
    if (!data) continue

    const props = Array.isArray(data.props)
      ? data.props
      : data.props
        ? [data.props]
        : []

    if (key === 'count' && props.length === 0) {
      ctx.readSchema.aggregate?.aggregates.push({
        path: ['count'],
        type: fn,
        resultPos: sizes.result,
      })
      continue
    }

    let i = 0
    for (const propName of props) {
      const propDef = typeDef.props.get(propName)
      if (!propDef) {
        throw new Error(`Aggregate property '${propName}' not found`)
      }

      let resSize = 0
      let accSize = 0
      const specificSizes = aggregateTypeMap.get(fn)
      if (specificSizes) {
        resSize += specificSizes.resultsSize
        accSize += specificSizes.accumulatorSize
      } else {
        resSize += 8
        accSize += 8
      }

      const buffer = createAggProp({
        propId: propDef.id,
        propType: propDef.type || 0,
        propDefStart: propDef.start || 0,
        aggFunction: fn,
        resultPos: sizes.result,
        accumulatorPos: sizes.accumulator,
      })
      ctx.readSchema.aggregate?.aggregates.push({
        path: propDef.path!,
        type: fn,
        resultPos: sizes.result,
      })
      ctx.readSchema.main.props[i] = readPropDef(propDef, ctx.locales)
      ctx.readSchema.main.len += propDef.size
      i += propDef.size

      ctx.query.data.set(buffer, ctx.query.length)
      ctx.query.length += AggPropByteSize

      sizes.result += resSize
      sizes.accumulator += accSize
    }
  }
}

export const isAggregateAst = (ast: QueryAst) => {
  return !!(
    ast.groupBy ||
    ast.count ||
    ast.sum ||
    ast.avg ||
    ast.min ||
    ast.max ||
    ast.stddev ||
    ast.var ||
    ast.harmonicMean ||
    ast.cardinality
  )
}

const checkSamplingMode = (ast: QueryAst): boolean => {
  if (
    ast['stddev']?.samplingMode === 'population' ||
    ast['var']?.samplingMode === 'population'
  )
    return false
  else return true
}
