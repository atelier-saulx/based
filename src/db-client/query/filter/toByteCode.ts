import { debugBuffer } from '../../../sdk.js'
import { writeUint32, writeUint64 } from '../../../utils/uint8.js'
import {
  FilterConditionByteSize,
  FilterOpCompare,
  FilterSelectByteSize,
  PropType,
  writeFilterCondition,
  writeFilterSelect,
} from '../../../zigTsExports.js'
import { combineIntermediateResults } from '../query.js'
import { byteSize } from '../toByteCode/utils.js'
import { IntermediateByteCode, QueryDefFilter } from '../types.js'
import { conditionBuffer } from './condition.js'

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

// const addRefs = (
//   result: IntermediateByteCode[],
//   def: QueryDefFilter,
//   index: number,
// ) => {
//   if (!def.references) {
//     return
//   }
//   for (const [prop, refDef] of def.references) {
//     const isMulti = refDef.ref?.typeIndex === PropType.references
//     const refBuffer = new Uint8Array(
//       FilterConditionByteSize + FilterSelectByteSize,
//     )

//     const nestedRefs = filterToBuffer(
//       refDef,
//       255,
//       index + refBuffer.byteLength,
//       false,
//     )
//     const edgeTypeId = refDef.ref?.edgeNodeTypeId ?? 0
//     const typeId = refDef.ref?.inverseTypeId ?? 0

//     // isMulti can have selections (which can be multiple that will be a special op)
//     const op =
//       edgeTypeId != 0
//         ? isMulti
//           ? FilterOpCompare.selectLargeRefs
//           : FilterOpCompare.selectLargeRef
//         : isMulti
//           ? FilterOpCompare.selectSmallRefs
//           : FilterOpCompare.selectSmallRef

//     let i = writeFilterCondition(
//       refBuffer,
//       {
//         op: { compare: op, prop: PropType.null },
//         prop,
//         // alignOffset: 0,
//         start: 0,
//         fieldSchema: 0,
//         len: 0,
//         offset: 255,
//         size: 4, // tmp
//       },
//       0,
//     )
//     i = writeFilterSelect(
//       refBuffer,
//       {
//         typeId,
//         edgeTypeId,
//         size: byteSize(nestedRefs),
//       },
//       i,
//     )

//     result.push(refBuffer)
//     result.push(nestedRefs)
//   }
//   // .or will be shitty scince we will jump and redo the reference there...
//   // so refs can get an or when we allow branching
// }

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

      if (key === 'ref') {
        res[key] = obj[key].path
      } else if (key === 'conditions') {
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
    // addRefs(result, def, byteSize(result))
  } else if (def.or && def.conditions.size != 0) {
    // const lastProp = addConditions(result, def, fromLastProp)
    // // addRefs(result, def, byteSize(result))
    // const resultSize = byteSize(result)
    // // const nextOrIndexBuffer = new Uint8Array(FilterConditionByteSize + 16)
    // // const offset = writeFilterCondition(
    // //   nextOrIndexBuffer,
    // //   {
    // //     op: FilterOp.nextOrIndex,
    // //     prop: fromLastProp,
    // //     start: 0,
    // //     fieldSchema: 0,
    // //   },
    // //   0,
    // // )
    // const { offset, condition } = conditionBuffer(
    //   { prop: fromLastProp, len: 8, start: 0 },
    //   8,
    //   { compare: FilterOpCompare.nextOrIndex, prop: PropType.null },
    // )
    // const nextOrIndex = resultSize + condition.byteLength + fromIndex
    // writeUint64(condition, nextOrIndex, offset + 8)
    // result.unshift(condition)
    // result.push(filterToBuffer(def.or, lastProp, nextOrIndex, false))
  } else {
    // fix this later
    // MOVE 1 up
  }

  if (top && result.length > 0) {
    console.dir(logger(def), { depth: 10 })
    const totalByteLength = byteSize(result)
    const res = new Uint8Array(totalByteLength)
    const nResult = combineIntermediateResults(res, 0, result)
    console.log('FILTER!', totalByteLength)
    debugBuffer(res)
  }

  return result
}
