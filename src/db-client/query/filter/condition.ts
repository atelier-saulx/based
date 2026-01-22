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
  PropType,
  writeFilterCondition,
} from '../../../zigTsExports.js'
import { FilterOpts, Operator } from './types.js'

const COND_ALIGN_SPACE = 16

export const conditionBuffer = (
  propDef: { start: number; prop: number; len: number } & Record<string, any>,
  size: number,
  op: FilterOpEnum,
) => {
  const condition = new Uint8Array(
    size + FilterConditionByteSize + COND_ALIGN_SPACE + 1 + propDef.len,
  )
  condition[0] = 255
  const offset =
    writeFilterCondition(
      condition,
      {
        op,
        start: propDef.start || 0,
        prop: propDef.prop,
        fieldSchema: 0,
        len: propDef.len,
        alignOffset: 255,
        size: size + propDef.len,
      },
      // propDef.len - 1 is space for alignment
      COND_ALIGN_SPACE + 1, //+ propDef.len - 1,
    ) + propDef.len
  return { condition, offset }
}

// const writeUint8 = (buf: Uint8Array, val: number, offset: number) => {
//   buf[offset] = val
//   return buf
// }

const getProps = {
  [PropType.uint32]: {
    write: writeUint32,
    ops: {
      eq: FilterOp.eqU32,
      eqBatch: FilterOp.eqU32Batch,
      eqBatchSmall: FilterOp.eqU32BatchSmall,
    },
  },
}

const getFilterOp = (
  propDef: PropDef | PropDefEdge,
  typeCfg: (typeof getProps)[keyof typeof getProps],
  operator: Operator,
  len: number,
): FilterOpEnum => {
  if (operator === '=') {
    const vectorLen = 16 / propDef.len
    // of a val might not fit in a vec
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
    const { write } = typeCfg
    const vectorLen = 16 / propDef.len
    const op = getFilterOp(propDef, typeCfg, operator, value.length)

    if (value.length > vectorLen) {
      const { condition, offset } = conditionBuffer(
        { ...propDef, start: propDef.start || 0 },
        value.length * propDef.len,
        op,
      )
      let i = offset

      // Actual values
      for (const v of value) {
        write(condition, v, i)
        i += propDef.len
      }

      // Empty padding for SIMD (16 bytes)
      for (let j = 0; j < vectorLen; j++) {
        write(condition, value[0], i)
        i += propDef.len
      }

      return condition
    }

    if (value.length > 1) {
      // Small batch
      const { condition, offset } = conditionBuffer(
        { ...propDef, start: propDef.start || 0 },
        value.length * propDef.len,
        op,
      )
      let i = offset
      for (let j = 0; j < vectorLen; j++) {
        // Allways use a full ARM neon simd vector (16 bytes)
        write(condition, j >= value.length ? value[0] : value[j], i)
        i += propDef.len
      }
      return condition
    } else {
      const { condition, offset } = conditionBuffer(
        { ...propDef, start: propDef.start || 0 },
        propDef.len,
        op,
      )
      write(condition, value[0], offset)
      return condition
    }
  }
}
