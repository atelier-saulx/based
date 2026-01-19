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

const logger = (obj: any): any => {
  if (obj && typeof obj === 'object') {
    if (obj instanceof Map)
      return Object.fromEntries([...obj].map(([k, v]) => [k, logger(v)]))
    if (Array.isArray(obj)) return obj.map(logger)
    const res: any = {}
    for (const key in obj) {
      if (key === 'schema' || key === 'props') {
        continue
      }
      if (key === 'conditions') {
        res[key] = obj[key]
      } else {
        res[key] = logger(obj[key])
      }
    }
    return res
  }
  return obj
}

export const filterToBuffer = (
  def: QueryDefFilter,
  fromLastProp: number = 255, // bit wrong for id...
  fromIndex: number = 0,
  top: boolean = true,
): IntermediateByteCode[] => {
  const result: IntermediateByteCode[] = []

  if (!def.or) {
    addConditions(result, def, fromLastProp)
  } else if (def.or && def.conditions.size != 0) {
    const lastProp = addConditions(result, def, fromLastProp)
    const resultSize = byteSize(result)
    const nextOrIndexBuffer = new Uint8Array(FilterConditionByteSize + 16)
    const offset = writeFilterCondition(
      nextOrIndexBuffer,
      {
        op: FilterOp.nextOrIndex,
        prop: fromLastProp,
        alignOffset: 255,
        start: 0, // this will also be used to offset
      },
      0,
    )

    const nextOrIndex = resultSize + nextOrIndexBuffer.byteLength + fromIndex
    writeUint64(nextOrIndexBuffer, nextOrIndex, offset + 8)

    result.unshift(nextOrIndexBuffer)
    result.push(filterToBuffer(def.or, lastProp, nextOrIndex, false))
  } else {
    // fix this later
    // MOVE 1 up
  }

  // if (top) {
  //   console.dir(logger(def), { depth: 10 })
  //   const totalByteLength = byteSize(result)
  //   const res = new Uint8Array(totalByteLength)
  //   const nResult = combineIntermediateResults(res, 0, result)
  //   console.log('FILTER!')
  //   debugBuffer(res)
  // }

  return result
}
