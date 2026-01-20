import { PropDef, PropDefEdge } from '../../../schema.js'
import { debugBuffer } from '../../../sdk.js'
import {
  writeDoubleLE,
  writeInt16,
  writeInt32,
  writeInt64,
  writeUint16,
  writeUint32,
} from '../../../utils/uint8.js'
import {
  FilterConditionByteSize,
  FilterOp,
  FilterOpEnum,
  FilterOpInverse,
  PropType,
  writeFilterCondition,
} from '../../../zigTsExports.js'
import { DbClient } from '../../index.js'
import { QueryDefFilter } from '../types.js'
import { FilterOpts, Operator } from './types.js'

const conditionBuffer = (
  propDef: PropDef | PropDefEdge,
  size: number,
  op: FilterOpEnum,
) => {
  const condition = new Uint8Array(size + FilterConditionByteSize + 16 + 1)
  condition[0] = 255
  writeFilterCondition(
    condition,
    {
      op,
      start: propDef.start || 0,
      prop: propDef.prop,
      fieldSchema: 0,
    },
    16 + 1,
  )
  return condition
}

// const writeUint8 = (buf: Uint8Array, val: number, offset: number) => {
//   buf[offset] = val
//   return buf
// }

const getProps = {
  [PropType.uint32]: {
    write: writeUint32,
    size: 4,
    ops: {
      eq: FilterOp.eqU32,
      eqBatch: FilterOp.eqU32Batch,
      eqBatchSmall: FilterOp.eqU32BatchSmall,
    },
  },
}

const getFilterOp = (
  typeCfg: (typeof getProps)[keyof typeof getProps],
  operator: Operator,
  len: number,
): FilterOpEnum => {
  if (operator === '=') {
    const vectorLen = 16 / typeCfg.size
    if (len > vectorLen) {
      return typeCfg.ops.eqBatch as FilterOpEnum
    } else if (len > 1) {
      return typeCfg.ops.eqBatchSmall as FilterOpEnum
    } else {
      return typeCfg.ops.eq as FilterOpEnum
    }
  }
  return 0 as FilterOpEnum // Default or 'exists'
}

export const createCondition = (
  propDef: PropDef | PropDefEdge,
  // TODO: this is tmp will become user operator
  operator: Operator,
  value?: any,
  opts?: FilterOpts,
) => {
  const typeCfg = getProps[propDef.typeIndex]
  if (typeCfg) {
    const { write, size } = typeCfg
    const vectorLen = 16 / size
    const op = getFilterOp(typeCfg, operator, value.length)

    if (value.length > vectorLen) {
      //   const condition = conditionBuffer(
      //     propDef,
      //     8 + value.length * size + 16,
      //     op,
      //   )
      //   let i = FilterConditionByteSize
      //   writeUint32(condition, value.length, i)
      //   i += 8 // 4 Extra for alignment padding
      //   // Actual values
      //   for (const v of value) {
      //     write(condition, v, i)
      //     i += size
      //   }
      //   // Empty padding for SIMD (16 bytes)
      //   for (let j = 0; j < vectorLen; j++) {
      //     write(condition, value[0], i)
      //     i += size
      //   }
      //   return condition
    }

    if (value.length > 1) {
      //   // Small batch
      //   const condition = conditionBuffer(propDef, 4 + 16, op)
      //   let i = FilterConditionByteSize
      //   i += 4
      //   for (let j = 0; j < vectorLen; j++) {
      //     // Allways use a full ARM neon simd vector (16 bytes)
      //     write(condition, j >= value.length ? value[0] : value[j], i)
      //     i += size
      //   }
      //   return condition
    } else {
      const condition = conditionBuffer(propDef, size, op)
      write(condition, value[0], FilterConditionByteSize + 16 + 1) // 4 Extra for alignment padding

      //   debugBuffer(condition)

      return condition
    }
  }
}
