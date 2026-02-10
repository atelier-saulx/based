import { writeUint16, writeInt16, writeUint32 } from '../../../utils/index.js'
import { QueryDef, QueryDefAggregation, QueryDefType } from '../types.js'
import { GroupBy, StepInput, aggFnOptions, setMode } from './types.js'
import {
  aggregationFieldDoesNotExist,
  validateStepRange,
  edgeNotImplemented,
} from '../validation.js'
import { aggregateTypeMap, Interval, IntervalString } from './types.js'
import { QueryBranch } from '../BasedDbQuery.js'
import {
  isPropDef,
  type PropDef,
  type PropDefEdge,
  type SchemaPropTree,
} from '../../../schema/index.js'
import {
  PropType,
  AggFunction,
  type AggFunctionEnum,
} from '../../../zigTsExports.js'
import { getTimeZoneOffsetInMinutes } from './aggregates.js'

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
  StepInput?: StepInput,
) => {
  const def = q.def!
  const fieldDef = def.schema!.props[field]
  if (!fieldDef) {
    aggregationFieldDoesNotExist(def, field)
  }
  if (fieldDef.hooks?.groupBy) {
    const hook = fieldDef.hooks.groupBy
    fieldDef.hooks.groupBy = undefined
    hook(q, field)
    fieldDef.hooks.groupBy = hook
  }
  if (def.schema!.hooks?.groupBy) {
    const hook = def.schema!.hooks.groupBy
    def.schema!.hooks.groupBy = undefined
    hook(q, field)
    def.schema!.hooks.groupBy = hook
  }

  if (!def.aggregate) {
    ensureAggregate(def)
  }
  const aggregate = def.aggregate!
  if (!aggregate.groupBy) {
    aggregate.size += 13 // field, srcPropType, start, len, stepType, stepRange, timezone
  }
  aggregate.groupBy = fieldDef
  aggregate.groupBy.stepRange = undefined
  aggregate.groupBy.stepType = undefined
  aggregate.groupBy.tz = undefined
  aggregate.groupBy.display = undefined

  if (
    typeof StepInput === 'object' &&
    StepInput !== null &&
    'step' in StepInput
  ) {
    if (typeof StepInput.timeZone == 'string') {
      aggregate.groupBy.tz = getTimeZoneOffsetInMinutes(StepInput.timeZone)
    }
    if (typeof StepInput?.step == 'string') {
      const intervalEnumKey = StepInput.step as IntervalString
      aggregate.groupBy.stepType = Interval[intervalEnumKey]
    } else {
      validateStepRange(def, StepInput?.step!)
      aggregate.groupBy.stepRange = StepInput.step
    }
  } else if (typeof StepInput == 'number') {
    validateStepRange(def, StepInput)
    aggregate.groupBy.stepRange = StepInput
  } else {
    const intervalEnumKey = StepInput as IntervalString
    aggregate.groupBy.stepType = Interval[intervalEnumKey]
  }
  if (typeof StepInput === 'object' && StepInput?.display) {
    aggregate.groupBy.display = StepInput?.display
  }
}

const updateAggregateDefs = (
  def: QueryDef,
  propDef: PropDef | PropDefEdge,
  aggType: AggFunctionEnum,
) => {
  const aggregate = def.aggregate!
  const aggregates = aggregate.aggregates
  if (!aggregates.get(propDef.prop)) {
    aggregates.set(propDef.prop, [])
    aggregate.size += 3 // field + fieldAggSize
  }

  const aggregateField = aggregates.get(propDef.prop)!
  aggregateField.push({
    type: aggType,
    propDef: propDef,
    resultPos: aggregate.totalResultsSize,
    accumulatorPos: aggregate.totalAccumulatorSize,
    isEdge: isEdge(propDef.path![0]),
  })

  const specificSizes = aggregateTypeMap.get(aggType)
  if (specificSizes) {
    aggregate.totalResultsSize += specificSizes.resultsSize
    aggregate.totalAccumulatorSize += specificSizes.accumulatorSize
  } else {
    aggregate.totalResultsSize += 8
    aggregate.totalAccumulatorSize += 8
  }
  // needs to add an extra field WRITE TO
  aggregate.size += 9 // aggType + propType + start + resultPos + accumulatorPos + isEdge
}

const isCount = (propString: string, aggType: AggFunctionEnum) => {
  return propString === 'count' || aggType === AggFunction.count
}

const isEdge = (propString) => {
  return propString.startsWith('$')
}

const isReferenceOrReferences = (typeIndex) => {
  return typeIndex === PropType.reference || typeIndex === PropType.references
}

const getPropDefinition = (
  def: QueryDef,
  propName: string,
  type: AggFunctionEnum,
  resolvedPropDef: PropDef | PropDefEdge | undefined,
): PropDef | PropDefEdge | undefined => {
  if (isCount(propName, type)) {
    return {
      schema: null as any,
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
  return resolvedPropDef || def.schema!.props[propName]
}

const IN_RECURSION = Symbol('IN_RECURSION')

// process references, nested, edges
// return undefined if skip to recursive call (refs)
const processPropPath = (
  query: QueryBranch<any>,
  path: string[],
  originalPropName: string,
  type: AggFunctionEnum,
): PropDef | PropDefEdge | undefined | typeof IN_RECURSION => {
  const def = query.def!
  let t: PropDef | SchemaPropTree = def.schema!.tree

  for (let i = 0; i < path.length; i++) {
    const propName = path[i]

    if (isEdge(propName)) {
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
      return undefined // end
    }
    t = t[propName]
    if (!t) {
      return undefined // path nor exist
    }
    if (isPropDef(t) && isReferenceOrReferences(t.typeIndex)) {
      const remainingPath = path.slice(i + 1).join('.')

      if (isEdge(remainingPath)) {
        return t // let the calling handle it
      }

      if (remainingPath) {
        addAggregate(query, type, [remainingPath], def.aggregate!.option)
      }

      return IN_RECURSION
    }
  }
  return isPropDef(t) ? (t as PropDef) : undefined
}

export const addAggregate = (
  query: QueryBranch<any>,
  type: AggFunctionEnum,
  propNames: string[],
  option?: aggFnOptions,
) => {
  const def = query.def!
  let hookPropNames: Set<string> | undefined

  ensureAggregate(def)

  if (option?.mode) {
    def.aggregate!.option = option
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

      if (def.schema!.hooks?.aggregate) {
        def.schema!.hooks.aggregate(query, hookPropNames || new Set(propNames))
      }
    }
  }
}
