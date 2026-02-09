import { TypeDef, PropDef } from '../../schema/defs/index.js'
import {
  QueryType,
  QueryIteratorType,
  AggFunction,
  AggHeaderByteSize,
  createAggHeader,
  createAggProp,
  createGroupByKeyProp,
  GroupByKeyPropByteSize,
  AggPropByteSize,
  type QueryIteratorTypeEnum,
  type AggFunctionEnum,
  IntervalInverse,
  PropType,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { filter } from './filter/filter.js'
import {
  aggregateTypeMap,
  IntervalString,
  Interval,
} from '../../db-client/query/aggregates/types.js'
import { readPropDef } from './readSchema.js'
import { getTimeZoneOffsetInMinutes } from '../../db-client/query/aggregates/aggregates.js'
import type { Enum } from 'valibot'

type Sizes = { result: number; accumulator: number }

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

  let sizes: Sizes = {
    result: 0,
    accumulator: 0,
  }

  const hasGroupBy = pushGroupBy(ast, ctx, typeDef, sizes)

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
  sizes: Sizes,
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

  let iteratorType = QueryIteratorType.aggregate
  if (hasGroupBy) iteratorType += 2
  if (filterSize > 0) iteratorType += 1

  headerBuffer = createAggHeader({
    ...commonHeader,
    op,
    typeId: typeDef.id,
    limit: (ast.range?.end || 1000) + rangeStart,
    iteratorType: iteratorType as QueryIteratorTypeEnum,
  })
  return headerBuffer
}

const pushAggregates = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
  sizes: { result: number; accumulator: number },
) => {
  ctx.readSchema.aggregate = ctx.readSchema.aggregate || {
    aggregates: [],
    totalResultsSize: 0,
    groupBy: undefined,
  }

  for (const key in AggFunction) {
    if (!(key in ast)) continue

    const data = ast[key]
    if (!data) continue

    const fn = AggFunction[key]

    let props = Array.isArray(data.props)
      ? data.props
      : data.props
        ? [data.props]
        : []

    let i = 0
    if (key === 'count' && props.length === 0) {
      ctx.readSchema.aggregate?.aggregates.push({
        path: ['count'],
        type: fn,
        resultPos: sizes.result,
      })
      props.push('count')
    }

    for (const propName of props) {
      let propDef: PropDef | any = typeDef.props.get(propName)
      if (propName === 'count' && fn === AggFunction.count) {
        propDef = {
          id: 255,
          path: [propName],
          start: 0,
          type: 1,
        }
      }
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

      ctx.readSchema.aggregate.totalResultsSize += resSize
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

const pushGroupBy = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
  sizes: Sizes,
): boolean => {
  if (!ast.groupBy) return false

  const { prop: propName, step, timeZone, display } = ast.groupBy
  const propDef = typeDef.props.get(propName)

  if (!propDef) {
    throw new Error(`Group By property '${propName}' not found in AST.`)
    // to put the equivalent to aggregationFieldDoesNotExist to handle the error
  }

  const { stepType, stepRange } = step
    ? parseStep(step)
    : { stepType: 0, stepRange: 0 }

  const timeZoneOffset = timeZone ? getTimeZoneOffsetInMinutes(timeZone) : 0

  const buffer = createGroupByKeyProp({
    propId: propDef.id,
    propType: propDef.type || 0,
    propDefStart: propDef.start || 0,
    stepType,
    stepRange,
    timezone: timeZoneOffset,
  })

  let enumProxy
  if (propDef.type === PropType.enum) {
    // @ts-ignore
    enumProxy = Object.values(propDef.enum)
  }

  ctx.query.data.set(buffer, ctx.query.length)
  ctx.query.length += GroupByKeyPropByteSize

  if (ctx.readSchema.aggregate) {
    ctx.readSchema.aggregate.groupBy = {
      typeIndex: propDef.type,
      stepRange,
      ...(stepType !== 0 && { stepType: IntervalInverse[stepType] }),
      ...(display !== undefined && { display }),
      ...(enumProxy !== undefined && { enum: enumProxy }),
    }
  }

  return true
}

type Step = { stepType: number; stepRange: number }
const parseStep = (step: number | IntervalString): Step => {
  let stepRange = 0
  let stepType = 0
  if (typeof step === 'string') {
    const intervalEnumKey = step as IntervalString
    stepType = Interval[intervalEnumKey]
  } else {
    // validateStepRange(def, step) // TODO: see/make the equivalent for def.errors
    stepRange = step
  }
  return { stepType, stepRange } as Step
}
