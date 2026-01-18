import {
  createFilterCondition,
  createFilterHeader,
  FilterConditionByteSize,
  FilterHeaderByteSize,
  FilterOp,
  PropType,
} from '../../../zigTsExports.js'
import { byteSize } from '../toByteCode/utils.js'
import { IntermediateByteCode, QueryDefFilter } from '../types.js'

export const filterToBuffer = (
  def: QueryDefFilter,
  fromLastProp: number = 255, // bit wrong for id...
): IntermediateByteCode[] => {
  const result: IntermediateByteCode[] = []
  if (!def.or) {
    for (const conditions of def.conditions.values()) {
      result.push(conditions)
    }
  } else if (def.or && def.conditions.size != 0) {
    let lastProp = 0
    for (const [prop, conditions] of def.conditions) {
      lastProp = prop
      result.push(conditions)
    }
    const resultSize = byteSize(result)
    result.unshift(
      createFilterCondition({
        op: FilterOp.and,
        prop: fromLastProp,
        start: 0,
        alignOffset: 0,
      }),
      createFilterHeader({
        propType: PropType.null,
        typeId: 0,
        edgeTypeId: 0,
        size: resultSize,
        nextOrIndex:
          resultSize + FilterHeaderByteSize + FilterConditionByteSize,
      }),
    )
    const or = filterToBuffer(def.or, lastProp)
    console.log('Here is OR', or)
    result.push(or)
  } else {
    // MOVE 1 up
  }

  return result
}
