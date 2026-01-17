import {
  createFilterPropHeader,
  FilterOp,
  PropType,
} from '../../../zigTsExports.js'
import { byteSize } from '../toByteCode/utils.js'
import { IntermediateByteCode, QueryDefFilter } from '../types.js'

export const filterToBuffer = (def: QueryDefFilter): IntermediateByteCode[] => {
  const result: IntermediateByteCode[] = []
  if (!def.or) {
    // if or we use the AND keyword
    for (const [prop, conditions] of def.conditions) {
      const propType =
        def.schema?.reverseProps[prop]?.typeIndex || PropType.microBuffer
      result.push(
        createFilterPropHeader({
          op: FilterOp.switchProp,
          prop: prop,
          propType,
        }),
        conditions,
      )
    }
  }

  return result
}
