import {
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  REVERSE_SIZE_MAP,
} from '../../../server/schema/types.js'
import { QueryDefFilter } from '../types.js'
import { isNumerical, operationToByte } from './operators.js'
import { Filter } from './types.js'
import { createVariableFilterBuffer } from './createVariableFilterBuffer.js'
import { createFixedFilterBuffer } from './createFixedFilterBuffer.js'
import { createReferenceFilter } from './createReferenceFilter.js'

export const primitiveFilter = (
  prop: PropDef | PropDefEdge,
  filter: Filter,
  conditions: QueryDefFilter,
) => {
  let [, operator, value] = filter
  const fieldIndexChar = prop.prop
  let buf: Buffer
  const op = operationToByte(operator)
  let size = 0
  const bufferMap = prop.__isEdge ? conditions.edges : conditions.conditions
  const isArray = Array.isArray(value)
  if (isArray && value.length === 1) {
    value = value[0]
  }
  const propSize = REVERSE_SIZE_MAP[prop.typeIndex]
  if (prop.typeIndex === REFERENCE) {
    buf = createReferenceFilter(prop, op, value)
  } else if (prop.typeIndex === REFERENCES) {
    if (op === 1 && !isArray) {
      value = [value]
    }
    buf = createFixedFilterBuffer(prop, 4, op, value, !isNumerical(op))
  } else if (propSize) {
    buf = createFixedFilterBuffer(prop, propSize, op, value, false)
  } else {
    buf = createVariableFilterBuffer(value, prop, op, buf)
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
