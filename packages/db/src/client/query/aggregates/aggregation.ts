import { QueryDef, QueryDefType } from '../types.js'
import { AggregateType } from './types.js'
import {
  PropDef,
  UINT32,
  REFERENCE,
  REFERENCES,
  SchemaPropTree,
  isPropDef,
} from '@based/schema/def'
import { aggregationFieldDoesNotExist } from '../validation.js'
import { aggregateTypeMap } from '../aggregates/types.js'

const ensureAggregate = (def: QueryDef) => {
  if (!def.aggregate) {
    def.aggregate = {
      size: 5,
      aggregates: new Map(),
      totalResultsSize: 0,
      totalAccumulatorSize: 0,
    }
  }
}

export const groupBy = (def: QueryDef, field: string) => {
  const fieldDef = def.schema.props[field]
  if (!fieldDef) {
    aggregationFieldDoesNotExist(def, field)
  }
  ensureAggregate(def)
  if (!def.aggregate.groupBy) {
    def.aggregate.size += 6
  }
  def.aggregate.groupBy = fieldDef
}

export const addAggregate = (
  type: AggregateType,
  def: QueryDef,
  fields: (string | string[])[],
) => {
  ensureAggregate(def)
  const aggregates = def.aggregate.aggregates
  for (const field of fields) {
    if (Array.isArray(field)) {
      addAggregate(type, def, field)
    } else {
      const fieldDef: PropDef =
        type === AggregateType.COUNT
          ? {
              prop: 255,
              path: [field],
              __isPropDef: true,
              len: 4,
              start: 0,
              typeIndex: UINT32,
              separate: true,
              validation: () => true,
              default: 0,
            }
          : def.schema.props[field]

      if (!fieldDef) {
        const path = field.split('.')
        let t: PropDef | SchemaPropTree = def.schema.tree
        for (let i = 0; i < path.length; i++) {
          const p = path[i]
          t = t[p]
          if (!t) {
            return
          }
          if (
            isPropDef(t) &&
            (t.typeIndex === REFERENCE || t.typeIndex === REFERENCES)
          ) {
            const f = path.slice(i + 1)
            addAggregate(type, def, [f])
          } else {
            aggregationFieldDoesNotExist(def, field)
          }
        }
      }

      if (!aggregates.get(fieldDef.prop)) {
        aggregates.set(fieldDef.prop, [])
        def.aggregate.size += 3
      }

      const aggregateField = aggregates.get(fieldDef.prop)
      aggregateField.push({
        propDef: fieldDef,
        type,
        resultPos: def.aggregate.totalResultsSize,
        accumulatorPos: def.aggregate.totalAccumulatorSize,
      })

      const specificSizes = aggregateTypeMap.get(type)
      if (specificSizes) {
        def.aggregate.totalResultsSize += specificSizes.resultsSize
        def.aggregate.totalAccumulatorSize += specificSizes.accumulatorSize
      } else {
        def.aggregate.totalResultsSize += 8
        def.aggregate.totalAccumulatorSize += 8
      }
      def.aggregate.size += 8
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
