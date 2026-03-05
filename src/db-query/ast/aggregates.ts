import { TypeDef, PropDef } from '../../schema/defs/index.js'
import {
  QueryType,
  QueryIteratorType,
  AggFunction,
  AggFunctionEnum,
  AggHeaderByteSize,
  createAggHeader,
  createAggProp,
  createGroupByKeyProp,
  GroupByKeyPropByteSize,
  AggPropByteSize,
  type QueryIteratorTypeEnum,
  IntervalInverse,
  PropType,
  AggRefsHeaderByteSize,
  createAggRefsHeader,
  IncludeOp,
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

type Sizes = { result: number; accumulator: number }

export const pushAggregatesQuery = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
  asReference?: PropDef,
) => {
  const headerStartPos = ctx.query.length
  const headerByteSize = asReference ? AggRefsHeaderByteSize : AggHeaderByteSize

  ctx.query.length += headerByteSize
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

  const { hasGroupBy, isEdge: groupByHasEdges } = pushGroupBy(
    ast,
    ctx,
    typeDef,
    sizes,
  )

  const hasEdges =
    pushAggregates(ast, ctx, typeDef, sizes, asReference) || groupByHasEdges

  const aggDefsSize =
    ctx.query.length - (headerStartPos + headerByteSize) - filterSize

  const headerBuffer = buildAggregateHeader(
    ast,
    typeDef,
    filterSize,
    hasGroupBy,
    hasEdges,
    sizes,
    asReference,
    aggDefsSize,
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
    !ast.variance &&
    !ast.hmean &&
    !ast.cardinality &&
    !ast.filter &&
    !ast.groupBy
  )
}

const buildAggregateHeader = (
  ast: QueryAst,
  typeDef: TypeDef,
  filterSize: number,
  hasGroupBy: boolean,
  hasEdges: boolean,
  sizes: Sizes,
  asReference?: PropDef,
  aggDefsSize: number = 0,
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

  if (asReference) {
    let iteratorType = QueryIteratorType.aggregate
    if (hasEdges) iteratorType += 4
    if (hasGroupBy) iteratorType += 2
    if (filterSize > 0) iteratorType += 1

    return createAggRefsHeader({
      ...commonHeader,
      op: IncludeOp.referencesAggregation,
      targetProp: asReference.id,
      iteratorType: iteratorType as QueryIteratorTypeEnum,
      aggDefsSize,
    })
  }

  const isCountOnly = isRootCountOnly(ast)
  const op = isCountOnly ? QueryType.aggregatesCount : QueryType.aggregates

  let headerBuffer: Uint8Array

  let iteratorType = QueryIteratorType.aggregate
  if (hasEdges) iteratorType += 4
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

type SizesType = { result: number; accumulator: number }

export const resolveProp = (
  typeDef: TypeDef,
  propFullName: string,
  asReference?: PropDef,
  isCount?: boolean,
): { isEdge: boolean; propDef: PropDef } => {
  let propDef: PropDef | any = typeDef.props.get(propFullName)
  let isEdge = false

  if (!propDef && asReference?.edges) {
    propDef = asReference.edges.props.get(propFullName)
    if (propDef) {
      isEdge = true
    }
  }

  if (isCount) {
    propDef = {
      id: 255,
      path: ['count'],
      start: 0,
      type: 1,
    }
  }

  if (!propDef) {
    throw new Error(`Property '${propFullName}' not found`)
  }

  return { isEdge, propDef }
}

const walkProp = (
  ctx: Ctx,
  sizes: SizesType,
  typeDef: TypeDef,
  propFullName: string,
  fn: AggFunctionEnum,
  asReference?: PropDef,
  isCount?: boolean,
): { isEdge: boolean; propDef: PropDef } => {
  const { isEdge, propDef } = resolveProp(
    typeDef,
    propFullName,
    asReference,
    isCount,
  )

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
    isEdge,
  })

  ctx.readSchema.aggregate?.aggregates.push({
    path: propDef.path!,
    type: fn,
    resultPos: sizes.result,
  })

  ctx.query.data.set(buffer, ctx.query.length)
  ctx.query.length += AggPropByteSize

  sizes.result += resSize
  sizes.accumulator += accSize

  ctx.readSchema.aggregate!.totalResultsSize += resSize

  return { isEdge, propDef }
}

const walkProps = (
  ctx: Ctx,
  sizes: SizesType,
  typeDef: TypeDef,
  targetAst: QueryAst,
  currentPath: string[],
  asReference?: PropDef,
): boolean => {
  let hasEdges = false
  let i = 0

  for (const key in AggFunction) {
    if (!(key in targetAst)) continue

    const data = targetAst[key]
    if (!data) continue

    const fn = AggFunction[key]

    let props = Array.isArray(data.props)
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
      props.push('count')
    }

    for (const propName of props) {
      const fullParts = [...currentPath]
      const isCount = propName !== 'count' || fn !== AggFunction.count
      if (!isCount) {
        fullParts.push(propName)
      }
      const fullPropName = fullParts.join('.')

      const { isEdge, propDef } = walkProp(
        ctx,
        sizes,
        typeDef,
        fullPropName,
        fn,
        asReference,
        isCount,
      )
      if (isEdge) hasEdges = true

      ctx.readSchema.main.props[i] = readPropDef(propDef, ctx.locales)
      ctx.readSchema.main.len += propDef.size
      i += propDef.size
    }
  }

  if (targetAst.props) {
    for (const key in targetAst.props) {
      const childPath = [...currentPath, key].join('.')
      const childPropDef = typeDef.props.get(childPath)

      if (
        childPropDef &&
        (childPropDef.type === PropType.reference ||
          childPropDef.type === PropType.references ||
          childPropDef.isEdge)
      ) {
        continue
      }

      if (
        isAggregateAst(targetAst.props[key], typeDef, [...currentPath, key])
      ) {
        if (
          walkProps(
            ctx,
            sizes,
            typeDef,
            targetAst.props[key],
            [...currentPath, key],
            asReference,
          )
        ) {
          hasEdges = true
        }
      }
    }
  }

  if (targetAst.edges) {
    for (const key in targetAst.edges) {
      const childPath = [...currentPath, key].join('.')
      const childPropDef = asReference?.edges?.props.get(childPath)

      if (
        childPropDef &&
        (childPropDef.type === PropType.reference ||
          childPropDef.type === PropType.references ||
          childPropDef.isEdge)
      ) {
        continue
      }

      if (
        isAggregateAst(targetAst.edges[key], typeDef, [...currentPath, key])
      ) {
        if (
          walkProps(
            ctx,
            sizes,
            typeDef,
            targetAst.edges[key],
            [...currentPath, key],
            asReference,
          )
        ) {
          hasEdges = true
        }
      }
    }
  }

  return hasEdges
}

const pushAggregates = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
  sizes: SizesType,
  asReference?: PropDef,
): boolean => {
  ctx.readSchema.aggregate = ctx.readSchema.aggregate || {
    aggregates: [],
    totalResultsSize: 0,
    groupBy: undefined,
  }

  return walkProps(ctx, sizes, typeDef, ast, [], asReference)
}

export const isAggregateAst = (
  ast: QueryAst,
  typeDef?: TypeDef,
  currentPath: string[] = [],
): boolean => {
  if (
    ast.groupBy ||
    ast.count ||
    ast.sum ||
    ast.avg ||
    ast.min ||
    ast.max ||
    ast.stddev ||
    ast.variance ||
    ast.hmean ||
    ast.cardinality
  ) {
    return true
  }
  if (ast.props && typeDef) {
    for (const key in ast.props) {
      const childPath = [...currentPath, key].join('.')
      const childPropDef = typeDef.props.get(childPath)

      if (
        childPropDef &&
        (childPropDef.type === PropType.reference ||
          childPropDef.type === PropType.references ||
          childPropDef.isEdge)
      ) {
        continue
      }

      if (isAggregateAst(ast.props[key], typeDef, [...currentPath, key])) {
        return true
      }
    }
  }

  return false
}

const checkSamplingMode = (ast: QueryAst): boolean => {
  if (
    ast['stddev']?.samplingMode === 'population' ||
    ast['variance']?.samplingMode === 'population'
  )
    return false
  else return true
}

const pushGroupBy = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
  sizes: Sizes,
  asReference?: PropDef,
): { hasGroupBy: boolean; isEdge: boolean } => {
  if (!ast.groupBy) return { hasGroupBy: false, isEdge: false }

  const { prop: propName, step, timeZone, display } = ast.groupBy
  const { propDef, isEdge } = resolveProp(typeDef, propName, asReference)

  if (!propDef) {
    throw new Error(`Group By property '${propName}' not found in AST.`)
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
    isEdge,
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

  return { hasGroupBy: true, isEdge }
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
