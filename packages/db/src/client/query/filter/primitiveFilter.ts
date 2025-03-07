import {
  CARDINALITY,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  REVERSE_SIZE_MAP,
} from '@based/schema/def'
import { QueryDef, QueryDefFilter } from '../types.js'
import { EQUAL, EXISTS, isNumerical, TYPE_NEGATE } from './types.js'
import { Filter } from './types.js'
import { createVariableFilterBuffer } from './createVariableFilterBuffer.js'
import { createFixedFilterBuffer } from './createFixedFilterBuffer.js'
import { createReferenceFilter } from './createReferenceFilter.js'
import { LangCode } from '@based/schema'
import { validateFilter } from '../validation.js'

export const primitiveFilter = (
  def: QueryDef,
  prop: PropDef | PropDefEdge,
  filter: Filter,
  conditions: QueryDefFilter,
  lang: LangCode,
) => {
  if (validateFilter(def, prop, filter)) {
    return
  }
  let [, ctx, value] = filter
  let buf: Buffer
  const fieldIndexChar = prop.prop
  const bufferMap = prop.__isEdge ? conditions.edges : conditions.conditions

  if (ctx.operation === EXISTS) {
    if (!conditions.exists) {
      conditions.exists = []
    }
    conditions.exists.push({
      prop: prop,
      negate: filter[1].type === TYPE_NEGATE,
    })
    return 4
  }

  let size = 0
  const isArray = Array.isArray(value)
  if (isArray && value.length === 1) {
    value = value[0]
  }
  const propSize = REVERSE_SIZE_MAP[prop.typeIndex]
  if (prop.typeIndex === REFERENCE) {
    buf = createReferenceFilter(prop, ctx, value)
  } else if (prop.typeIndex === REFERENCES) {
    if (ctx.operation === EQUAL && !isArray) {
      value = [value]
    }
    buf = createFixedFilterBuffer(
      prop,
      4,
      ctx,
      value,
      !isNumerical(ctx.operation),
    )
  } else if (prop.typeIndex === CARDINALITY) {
    buf = createFixedFilterBuffer(prop, 2, ctx, value, false)
  } else if (propSize) {
    buf = createFixedFilterBuffer(prop, propSize, ctx, value, false)
  } else {
    buf = createVariableFilterBuffer(value, prop, ctx, lang)
  }
  // ADD OR if array for value
  let arr = bufferMap.get(fieldIndexChar)
  if (!arr) {
    size += 3 // [field] [size 2]
    arr = []
    bufferMap.set(fieldIndexChar, arr)
  }
  size += buf.byteLength
  arr.push(buf)
  return size
}
