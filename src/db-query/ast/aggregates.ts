import { TypeDef, PropDef } from '../../schema/defs/index.js'
import {
  QueryType,
  QueryIteratorType,
  AggHeaderByteSize,
  createAggHeader,
  createGroupByKeyProp,
  GroupByKeyPropByteSize,
  type QueryIteratorTypeEnum,
  IntervalInverse,
  PropType,
  AggRefsHeaderByteSize,
  createAggRefsHeader,
  IncludeOp,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { filter } from './filter/filter.js'
import { walkProps, resolveProp } from './aggPropWalker.js'

type Sizes = { result: number; accumulator: number }
enum Interval {
  none = 0,
  epoch = 1,
  hour = 2,
  // minute = 3,
  // second = 4,
  // microseconds = 5,
  day = 6, // The day of the month (1–31); for interval values, the number of days
  doy = 7, // The day of the year (0–365)
  dow = 8, // The day of the week as Sunday (0) to Saturday (6)
  isoDOW = 9, // The day of the week as Monday (1) to Sunday (7). This matches the ISO 8601 day of the week numbering.
  // week = 10, // The number of the ISO 8601 week-numbering week of the year
  month = 11, // The number of the month within the year (0–11);
  // isoMonth = 12, // The number of the month within the year (1–12);
  // quarter = 13, // The quarter of the year (1–4) that the date is in
  year = 14,
  // timeZone = 15, // ? seconds? or string?
}

export type IntervalString = keyof typeof Interval

export type StepObject = {
  step?: number | IntervalString
  timeZone?: string
  display?: Intl.DateTimeFormat
}

export type StepShorthand = number | IntervalString
export type StepInput = StepObject | StepShorthand

const getTimeZoneOffsetInMinutes = (
  timeZone: string,
  date: Date = new Date(),
): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const getPart = (partName: string) =>
    parseInt(parts.find((p) => p.type === partName)?.value || '0', 10)

  const targetTimeAsUTC = Date.UTC(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    getPart('hour'),
    getPart('minute'),
    getPart('second'),
  )

  const originalUTCTime = date.getTime()
  const offsetInMilliseconds = targetTimeAsUTC - originalUTCTime
  const offsetInMinutes = offsetInMilliseconds / (1000 * 60)

  return Math.round(offsetInMinutes)
}
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

  const {
    hasGroupBy,
    isEdge: groupByHasEdges,
    edgePropId: groupByEdgePropId,
  } = pushGroupBy(ast, ctx, typeDef, sizes, asReference)

  const { hasEdges: aggHasEdges, edgePropId: aggEdgePropId } = pushAggregates(
    ast,
    ctx,
    typeDef,
    sizes,
    asReference,
  )

  const hasEdges = aggHasEdges || groupByHasEdges
  const edgePropId = aggEdgePropId || groupByEdgePropId

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
    edgePropId,
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
  edgePropId?: number,
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
    edgePropId: edgePropId || 0,
  })
  return headerBuffer
}

export type SizesType = { result: number; accumulator: number }

const pushAggregates = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
  sizes: SizesType,
  asReference?: PropDef,
): { hasEdges: boolean; edgePropId?: number } => {
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

const collectGroupBys = (
  ast: QueryAst,
  currentPath: string[] = [],
): {
  prop: string
  step?: StepShorthand
  timeZone?: string
  display?: any
}[] => {
  let result: {
    prop: string
    step?: StepShorthand
    timeZone?: string
    display?: any
  }[] = []
  if (ast.groupBy) {
    const arr = Array.isArray(ast.groupBy) ? ast.groupBy : [ast.groupBy]
    for (const g of arr) {
      if (currentPath.length > 0) {
        result.push({ ...g, prop: currentPath.join('.') + '.' + g.prop })
      } else {
        result.push(g)
      }
    }
  }
  if (ast.props) {
    for (const key in ast.props) {
      result = result.concat(
        collectGroupBys(ast.props[key], [...currentPath, key]),
      )
    }
  }
  if (ast.edges) {
    for (const key in ast.edges) {
      result = result.concat(
        collectGroupBys(ast.edges[key], [...currentPath, key]),
      )
    }
  }
  return result
}

const pushGroupBy = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
  sizes: Sizes,
  asReference?: PropDef,
): { hasGroupBy: boolean; isEdge: boolean; edgePropId?: number } => {
  const groupByArray = collectGroupBys(ast)
  if (groupByArray.length === 0) return { hasGroupBy: false, isEdge: false }

  let anyEdge = false
  let defaultEdgePropId: number | undefined
  const groupByInfos: any[] = []

  for (let i = 0; i < groupByArray.length; i++) {
    const { prop: propName, step, timeZone, display } = groupByArray[i]
    const { propDef, isEdge, edgePropId } = resolveProp(
      typeDef,
      propName,
      asReference,
    )

    if (!propDef) {
      throw new Error(`Group By property '${propName}' not found in AST.`)
    }

    if (isEdge) {
      anyEdge = true
      if (edgePropId) defaultEdgePropId = edgePropId
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
      hasNext: i < groupByArray.length - 1,
    })

    let enumProxy
    if (propDef.type === PropType.enum) {
      // @ts-ignore
      enumProxy = Object.values(propDef.enum)
    }

    ctx.query.data.set(buffer, ctx.query.length)
    ctx.query.length += GroupByKeyPropByteSize

    groupByInfos.push({
      typeIndex: propDef.type,
      stepRange,
      ...(stepType !== 0 && { stepType: IntervalInverse[stepType] }),
      ...(display !== undefined && { display }),
      ...(enumProxy !== undefined && { enum: enumProxy }),
    })
  }

  if (ctx.readSchema.aggregate) {
    ctx.readSchema.aggregate.groupBy = groupByInfos
  }

  return { hasGroupBy: true, isEdge: anyEdge, edgePropId: defaultEdgePropId }
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
