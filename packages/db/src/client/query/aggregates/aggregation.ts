import { writeUint16, writeInt16, writeUint32 } from '@based/utils'
import { QueryDef, QueryDefAggregation, QueryDefType } from '../types.js'
import { GroupBy, StepInput, aggFnOptions, setMode } from './types.js'
import {
  PropDef,
  UINT32,
  SchemaPropTree,
  REFERENCE,
  REFERENCES,
  PropDefEdge,
  isPropDef,
} from '@based/schema/def'
import {
  aggregationFieldDoesNotExist,
  validateStepRange,
  edgeNotImplemented,
} from '../validation.js'
import {
  aggregateTypeMap,
  Interval,
  IntervalString,
} from '../aggregates/types.js'
import { QueryBranch } from '../BasedDbQuery.js'
import { AggregateType } from '@based/protocol/db-read'
import { createOrGetEdgeRefQueryDef } from '../include/utils.js'

export const aggregateToBuffer = (
  aggregates: QueryDefAggregation,
): Uint8Array => {
  const aggBuffer = new Uint8Array(aggregates.size)
  let i = 0
  if (aggregates.groupBy) {
    aggBuffer[i] = GroupBy.HAS_GROUP
    i += 1
    aggBuffer[i] = aggregates.groupBy.prop
    i += 1
    aggBuffer[i] = aggregates.groupBy.typeIndex
    i += 1
    writeUint16(aggBuffer, aggregates.groupBy.start, i)
    i += 2
    writeUint16(aggBuffer, aggregates.groupBy.len, i)
    i += 2
    aggBuffer[i] = aggregates.groupBy.stepType || 0
    i += 1
    writeUint32(aggBuffer, aggregates.groupBy.stepRange || 0, i)
    i += 4
    writeInt16(aggBuffer, aggregates.groupBy.tz || 0, i)
    i += 2
  } else {
    aggBuffer[i] = GroupBy.NONE
    i += 1
  }
  writeUint16(aggBuffer, aggregates.totalResultsSize, i)
  i += 2
  writeUint16(aggBuffer, aggregates.totalAccumulatorSize, i)
  i += 2
  aggBuffer[i] = setMode[aggregates?.option?.mode] || 0
  i += 1
  for (const [prop, aggregatesArray] of aggregates.aggregates.entries()) {
    aggBuffer[i] = prop
    i += 1
    let sizeIndex = i
    let size = 0
    i += 2
    for (const agg of aggregatesArray) {
      let startI = i
      aggBuffer[i] = agg.type
      i += 1
      aggBuffer[i] = agg.propDef.typeIndex
      i += 1
      writeUint16(aggBuffer, agg.propDef.start, i)
      i += 2
      writeUint16(aggBuffer, agg.resultPos, i)
      i += 2
      writeUint16(aggBuffer, agg.accumulatorPos, i)
      i += 2
      aggBuffer[i] = agg.propDef.__isEdge ? 1 : 0
      i += 1
      size += i - startI
    }
    writeUint16(aggBuffer, size, sizeIndex)
  }
  // console.log('aggBuffer', aggBuffer)
  return aggBuffer
}

const ensureAggregate = (def: QueryDef) => {
  if (!def.aggregate) {
    def.aggregate = {
      size: 6, // groupBy + resultSize, accumulatorSize, mode,
      aggregates: new Map(),
      totalResultsSize: 0,
      totalAccumulatorSize: 0,
    }
  }
}

export const groupBy = (
  q: QueryBranch<any>,
  field: string,
  StepInput: StepInput,
) => {
  const def = q.def
  const fieldDef = def.schema.props[field]
  if (!fieldDef) {
    aggregationFieldDoesNotExist(def, field)
  }
  const groupByPropHook = fieldDef.hooks?.groupBy
  if (groupByPropHook) {
    fieldDef.hooks.groupBy = null
    groupByPropHook(q, field)
    fieldDef.hooks.groupBy = groupByPropHook
  }
  const groupByHook = def.schema.hooks?.groupBy
  if (groupByHook) {
    def.schema.hooks.groupBy = null
    groupByHook(q, field)
    def.schema.hooks.groupBy = groupByHook
  }

  if (!def.aggregate) {
    ensureAggregate(def)
  }

  if (!def.aggregate.groupBy) {
    def.aggregate.size += 13 // field, srcPropType, start, len, stepType, stepRange, timezone
  }
  def.aggregate.groupBy = fieldDef
  def.aggregate.groupBy.stepRange = undefined
  def.aggregate.groupBy.stepType = undefined
  def.aggregate.groupBy.tz = undefined
  def.aggregate.groupBy.display = undefined

  if (
    typeof StepInput === 'object' &&
    StepInput !== null &&
    'step' in StepInput
  ) {
    if (typeof StepInput.timeZone == 'string') {
      def.aggregate.groupBy.tz = getTimeZoneOffsetInMinutes(StepInput.timeZone)
    }
    if (typeof StepInput?.step == 'string') {
      const intervalEnumKey = StepInput.step as IntervalString
      def.aggregate.groupBy.stepType = Interval[intervalEnumKey]
    } else {
      validateStepRange(def, StepInput?.step)
      def.aggregate.groupBy.stepRange = StepInput.step
    }
  } else if (typeof StepInput == 'number') {
    validateStepRange(def, StepInput)
    def.aggregate.groupBy.stepRange = StepInput
  } else {
    const intervalEnumKey = StepInput as IntervalString
    def.aggregate.groupBy.stepType = Interval[intervalEnumKey]
  }
  if (typeof StepInput === 'object' && StepInput?.display) {
    def.aggregate.groupBy.display = StepInput?.display
  }
}

const updateAggregateDefs = (
  def: QueryDef,
  propDef: PropDef | PropDefEdge,
  aggType: AggregateType,
) => {
  const aggregates = def.aggregate.aggregates
  if (!aggregates.get(propDef.prop)) {
    aggregates.set(propDef.prop, [])
    def.aggregate.size += 3 // field + fieldAggSize
  }

  const aggregateField = aggregates.get(propDef.prop)
  aggregateField.push({
    type: aggType,
    propDef: propDef,
    resultPos: def.aggregate.totalResultsSize,
    accumulatorPos: def.aggregate.totalAccumulatorSize,
    isEdge: isEdge(propDef.path[0]),
  })

  const specificSizes = aggregateTypeMap.get(aggType)
  if (specificSizes) {
    def.aggregate.totalResultsSize += specificSizes.resultsSize
    def.aggregate.totalAccumulatorSize += specificSizes.accumulatorSize
  } else {
    def.aggregate.totalResultsSize += 8
    def.aggregate.totalAccumulatorSize += 8
  }
  // needs to add an extra field WRITE TO
  def.aggregate.size += 9 // aggType + propType + start + resultPos + accumulatorPos + isEdge
}

const isCount = (propString: string, aggType: AggregateType) => {
  return propString === 'count' || aggType === AggregateType.COUNT
}

const isEdge = (propString) => {
  return propString.startsWith('$')
}

const isReferenceOrReferences = (typeIndex) => {
  return typeIndex === REFERENCE || typeIndex === REFERENCES
}

const getPropDefinition = (
  def: QueryDef,
  propName: string,
  type: AggregateType,
  resolvedPropDef: PropDef | PropDefEdge | undefined,
): PropDef | PropDefEdge | undefined => {
  if (isCount(propName, type)) {
    return {
      prop: 255,
      path: [propName],
      __isPropDef: true,
      len: 4,
      start: 0,
      typeIndex: 1,
      separate: true,
      validation: () => true,
      default: 0,
    } as PropDef
  }
  return resolvedPropDef || def.schema.props[propName]
}

const IN_RECURSION = Symbol('IN_RECURSION')

// process references, nested, edges
// return undefined if skip to recursive call (refs)
const processPropPath = (
  query: QueryBranch<any>,
  path: string[],
  originalPropName: string,
  type: AggregateType,
): PropDef | PropDefEdge | undefined | typeof IN_RECURSION => {
  let t: PropDef | SchemaPropTree = query.def.schema.tree

  for (let i = 0; i < path.length; i++) {
    const propName = path[i]

    if (isEdge(propName)) {
      // @ts-ignore
      const edgePropDef = query.def.target?.propDef?.edges[propName]
      if (edgePropDef) {
        return edgePropDef
      } else {
        edgeNotImplemented(query.def, propName)
        return undefined
      }
    }
    if (!t) {
      return undefined // end
    }
    t = t[propName]
    if (!t) {
      return undefined // path nor exist
    }
    if (isPropDef(t) && isReferenceOrReferences(t.typeIndex)) {
      const remainingPath = path.slice(i + 1).join('.')

      if (isEdge(remainingPath)) {
        return t.edges[remainingPath] //MV: r👹👹👹emember this is just a test // let the calling handle it
      }

      if (remainingPath) {
        addAggregate(query, type, [remainingPath], query.def.aggregate.option)
      }

      return IN_RECURSION
    }
  }
  return isPropDef(t) ? (t as PropDef) : undefined
}

export const addAggregate = (
  query: QueryBranch<any>,
  type: AggregateType,
  propNames: string[],
  option?: aggFnOptions,
) => {
  const def = query.def
  let hookPropNames: Set<string>

  ensureAggregate(def)

  if (option?.mode) {
    def.aggregate.option = option
  }

  for (const propName of propNames) {
    if (Array.isArray(propName)) {
      addAggregate(query, type, propName, option)
    } else {
      const path = propName.split('.')

      let resolvedPropDef = processPropPath(query, path, propName, type)
      if (resolvedPropDef === IN_RECURSION) {
        continue
      }
      let propDef = getPropDefinition(def, propName, type, resolvedPropDef)

      if (!propDef) {
        aggregationFieldDoesNotExist(def, propName)
        return
      }

      if (propDef.hooks?.aggregate) {
        hookPropNames ??= new Set(propNames)
        propDef.hooks.aggregate(query, hookPropNames)
      }
      updateAggregateDefs(def, propDef, type)

      if (def.schema.hooks?.aggregate) {
        def.schema.hooks.aggregate(query, hookPropNames || new Set(propNames))
      }
    }
  }
}

export const isRootCountOnly = (def: QueryDef, filterSize: number) => {
  if (filterSize != 0) {
    return false
  }
  if (def.type !== QueryDefType.Root) {
    return false
  }
  if (def.aggregate.groupBy) {
    return false
  }
  if (def.aggregate.aggregates.size !== 1) {
    return false
  }
  if (!def.aggregate.aggregates.has(255)) {
    return false
  }
  const aggs = def.aggregate.aggregates.get(255)
  if (aggs.length !== 1) {
    return false
  }
  if (aggs[0].type !== AggregateType.COUNT) {
    return false
  }
  if (def.filter && def.filter.size > 0) {
    return false
  }
  return true
}

function getTimeZoneOffsetInMinutes(
  timeZone: string,
  date: Date = new Date(),
): number {
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
