import { debugBuffer } from '../../../sdk.js'
import { writeUint32, writeUint64 } from '../../../utils/uint8.js'
import {
  createFilterCondition,
  FilterConditionByteSize,
  FilterHeaderByteSize,
  FilterOp,
  writeFilterCondition,
} from '../../../zigTsExports.js'
import { combineIntermediateResults } from '../query.js'
import { byteSize } from '../toByteCode/utils.js'
import { IntermediateByteCode, QueryDefFilter } from '../types.js'

const addConditions = (
  result: IntermediateByteCode[],
  def: QueryDefFilter,
  fromLastProp: number, // bit wrong for id...
) => {
  let lastProp = -1
  const prevProp = def.conditions.get(fromLastProp)
  if (prevProp) {
    lastProp = fromLastProp
    result.push(prevProp)
  }
  for (const [prop, conditions] of def.conditions) {
    if (prop !== fromLastProp) {
      result.push(conditions)
      lastProp = prop
    }
  }
  return lastProp
}

export const filterToBuffer = (
  def: QueryDefFilter,
  fromLastProp: number = 255, // bit wrong for id...
): IntermediateByteCode[] => {
  const result: IntermediateByteCode[] = []
  if (!def.or) {
    addConditions(result, def, fromLastProp)
  } else if (def.or && def.conditions.size != 0) {
    const lastProp = addConditions(result, def, fromLastProp)
    const resultSize = byteSize(result)
    const nextOrIndex = new Uint8Array(FilterConditionByteSize + 16)
    const offset = writeFilterCondition(
      nextOrIndex,
      {
        op: FilterOp.nextOrIndex,
        prop: fromLastProp,
        alignOffset: 255,
        start: 0, // this will also be used to offset
      },
      0,
    )
    writeUint64(nextOrIndex, resultSize + nextOrIndex.byteLength, offset + 8)

    // const nextOrIndex = new Uint8Array(2 + 16)
    // nextOrIndex[0] = FilterOp.nextOrIndex
    // // alignmentOfset
    // nextOrIndex[1] = 255
    // writeUint64(nextOrIndex, resultSize + nextOrIndex.byteLength, 2)
    result.unshift(nextOrIndex)
    result.push(filterToBuffer(def.or, lastProp))
  } else {
    // fix this later
    // MOVE 1 up
  }

  // const totalByteLength = byteSize(result)
  // const res = new Uint8Array(totalByteLength)
  // const nResult = combineIntermediateResults(res, 0, result)
  // console.log('FILTER!')
  // debugBuffer(res)

  return result
}
