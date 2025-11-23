import { FilterCondition, QueryDef, QueryDefFilter } from '../types.js'
import {
  EQUAL,
  EXISTS,
  isNumerical,
  TYPE_NEGATE,
  TYPE_DEFAULT,
} from './types.js'
import { Filter } from './types.js'
import { createVariableFilterBuffer } from './createVariableFilterBuffer.js'
import { createFixedFilterBuffer } from './createFixedFilterBuffer.js'
import { createReferenceFilter } from './createReferenceFilter.js'
import { validateFilter } from '../validation.js'
import {
  REVERSE_TYPE_INDEX_MAP,
  type PropDef,
  type PropDefEdge,
} from '@based/schema'
import { PropType } from '../../../zigTsExports.js'
import { REVERSE_SIZE_MAP } from '@based/schema/dist/def/types.js'

export const primitiveFilter = (
  def: QueryDef,
  prop: PropDef | PropDefEdge,
  filter: Filter,
  conditions: QueryDefFilter,
  lang: QueryDef['lang'],
) => {
  if (validateFilter(def, prop, filter)) {
    return 0
  }
  let [, ctx, value] = filter
  let parsedCondition: FilterCondition
  const fieldIndexChar = prop.prop
  const bufferMap = prop.__isEdge ? conditions.edges : conditions.conditions

  if (ctx.operation === EXISTS) {
    if (!prop.separate) {
      if (prop.typeIndex === PropType.string) {
        ctx.operation = EQUAL
        ctx.type = ctx.type === TYPE_NEGATE ? TYPE_DEFAULT : TYPE_NEGATE
        value = ''
      } else {
        console.error(
          'MISSING EXIST / !EXIST FILTER FOR',
          prop.path,
          REVERSE_TYPE_INDEX_MAP[prop.typeIndex],
        )
      }
    } else {
      if (!conditions.exists) {
        conditions.exists = []
      }
      conditions.exists.push({
        prop: prop,
        negate: filter[1].type === TYPE_NEGATE,
      })
      return 4
    }
  }

  let size = 0
  const isArray = Array.isArray(value)
  if (isArray && value.length === 1) {
    value = value[0]
  }
  const propSize = REVERSE_SIZE_MAP[prop.typeIndex]
  if (prop.typeIndex === PropType.reference) {
    parsedCondition = createReferenceFilter(prop, ctx, value)
  } else if (prop.typeIndex === PropType.references) {
    if (ctx.operation === EQUAL && !isArray) {
      value = [value]
    }
    parsedCondition = createFixedFilterBuffer(
      prop,
      4,
      ctx,
      value,
      !isNumerical(ctx.operation),
    )
  } else if (prop.typeIndex === PropType.cardinality) {
    parsedCondition = createFixedFilterBuffer(prop, 4, ctx, value, false)
  } else if (propSize) {
    parsedCondition = createFixedFilterBuffer(prop, propSize, ctx, value, false)
  } else {
    parsedCondition = createVariableFilterBuffer(value, prop, ctx, lang)
  }
  // ADD OR if array for value
  let arr = bufferMap.get(fieldIndexChar)
  if (!arr) {
    size += 3 // [field] [size 2]
    arr = []
    bufferMap.set(fieldIndexChar, arr)
  }
  size += parsedCondition.buffer.byteLength

  if ('subscriptionMeta' in parsedCondition) {
    conditions.hasSubMeta = true
  }
  arr.push(parsedCondition)
  return size
}
