import { writeUint16, writeInt16, writeUint32 } from '@based/utils'
import { QueryDef, QueryDefAggregation, QueryDefType } from '../types.js'
import { GroupBy, StepInput, aggFnOptions, setMode } from './types.js'
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
import {
  typeIndexMap,
  type QueryPropDef,
  type PropDef,
  type TypeDef,
} from '@based/schema'

export const aggregateToBuffer = (
  aggregates: QueryDefAggregation,
): Uint8Array => {
  const aggBuffer = new Uint8Array(aggregates.size)
  let i = 0
  if (aggregates.groupBy) {
    aggBuffer[i] = GroupBy.HAS_GROUP
    i += 1
    aggBuffer[i] = aggregates.groupBy.id
    i += 1
    aggBuffer[i] = aggregates.groupBy.typeIndex
    i += 1
    if ('main' in aggregates.groupBy) {
      writeUint16(aggBuffer, aggregates.groupBy.main.start || 0, i)
      i += 2
      writeUint16(aggBuffer, aggregates.groupBy.main.size || 0, i)
    } else {
      writeUint16(aggBuffer, 0, i)
      i += 2
      writeUint16(aggBuffer, 0, i)
    }
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
  const mode = aggregates?.option?.mode
  aggBuffer[i] = (mode && setMode[mode]) || 0
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
      writeUint16(
        aggBuffer,
        'main' in agg.propDef ? agg.propDef.main.start : 0,
        i,
      )
      i += 2
      writeUint16(aggBuffer, agg.resultPos, i)
      i += 2
      writeUint16(aggBuffer, agg.accumulatorPos, i)
      i += 2
      aggBuffer[i] = agg.propDef.typeDef.edge ? 1 : 0
      i += 1
      size += i - startI
    }
    writeUint16(aggBuffer, size, sizeIndex)
  }
  // console.log('aggBuffer', aggBuffer)
  return aggBuffer
}

function ensureAggregate(def: QueryDef): asserts def is QueryDef & {
  aggregate: Exclude<QueryDef['aggregate'], null>
} {
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
  StepInput?: StepInput,
) => {
  const def = q.def as QueryDef
  const fieldDef = def.schema?.props[field]

  if (!fieldDef || fieldDef.type === 'object') {
    aggregationFieldDoesNotExist(def, field)
    return
  }

  if (fieldDef.hooks?.groupBy) {
    const hook = fieldDef.hooks.groupBy
    fieldDef.hooks.groupBy = undefined
    hook(q, field)
    fieldDef.hooks.groupBy = hook
  }

  if (def.schema?.hooks?.groupBy) {
    const hook = def.schema.hooks.groupBy
    def.schema.hooks.groupBy = undefined
    hook(q, field)
    def.schema.hooks.groupBy = hook
  }

  ensureAggregate(def)

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
  propDef: QueryPropDef,
  aggType: AggregateType,
) => {
  ensureAggregate(def)
  const aggregates = def.aggregate.aggregates
  if (!aggregates.get(propDef.id)) {
    aggregates.set(propDef.id, [])
    def.aggregate.size += 3 // field + fieldAggSize
  }

  const aggregateField = aggregates.get(propDef.id)
  aggregateField?.push({
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
  return (
    typeIndex === typeIndexMap.reference ||
    typeIndex === typeIndexMap.references
  )
}

const getPropDefinition = (
  def: QueryDef,
  propName: string,
  type: AggregateType,
  resolvedPropDef: QueryPropDef,
): QueryPropDef | void => {
  console.warn('TODO: aggregates getPropDefinition')
  // if (isCount(propName, type)) {

  // return {

  //   id: 255,
  //   typeIndex: 1,
  //   path: [propName],
  //   // schema: null,
  //   // prop: 255,
  //   // path: [propName],
  //   // __isPropDef: true,
  //   // len: 4,
  //   // start: 0,
  //   // typeIndex: 1,
  //   // separate: true,
  //   // validation: () => true,
  //   // default: 0,
  // }
  // }
  // return resolvedPropDef || def.schema?.props[propName]
}

const IN_RECURSION = Symbol('IN_RECURSION')

// process references, nested, edges
// return undefined if skip to recursive call (refs)
const processPropPath = (
  query: QueryBranch<any>,
  path: string[],
  originalPropName: string,
  type: AggregateType,
): QueryPropDef | undefined | typeof IN_RECURSION => {
  const def = query.def as QueryDef
  let t: PropDef | TypeDef | null = def.schema

  for (let i = 0; i < path.length; i++) {
    const propName = path[i]

    if (isEdge(propName)) {
      // TODO what to do here?
      // @ts-ignore
      const edgePropDef = def.target?.propDef?.edges[propName]
      if (edgePropDef) {
        return edgePropDef
      } else {
        edgeNotImplemented(def, propName)
        return undefined
      }
    }

    if (!t) {
      return undefined // path nor exist
    }

    if ('props' in t) {
      t = t.props[propName]
    }

    if (!t) {
      return undefined // path nor exist
    }

    if ('target' in t) {
      const remainingPath = path.slice(i + 1).join('.')

      if (isEdge(remainingPath)) {
        return t // let the calling handle it
      }

      if (remainingPath) {
        addAggregate(query, type, [remainingPath], def.aggregate?.option)
      }

      return IN_RECURSION
    }
  }

  return t && 'typeIndex' in t ? t : undefined
}

export const addAggregate = (
  query: QueryBranch<any>,
  type: AggregateType,
  propNames: string[],
  option?: aggFnOptions,
) => {
  const def = query.def as QueryDef
  let hookPropNames: Set<string> | undefined

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
      if (resolvedPropDef === IN_RECURSION || !resolvedPropDef) {
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

      if (def.schema?.hooks?.aggregate) {
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
  ensureAggregate(def)
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
  if (aggs?.length !== 1) {
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
