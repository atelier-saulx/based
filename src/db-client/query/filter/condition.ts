import { PropDef, PropDefEdge } from '../../../schema.js'
import { propIndexOffset } from '../../../schema/def/utils.js'
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
        offset: 255,
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
      range: FilterOp.rangeU32,
      gt: FilterOp.gtU32,
      gtBatch: FilterOp.gtU32Batch,
      gtBatchSmall: FilterOp.gtU32BatchSmall,
      lt: FilterOp.ltU32,
      ltBatch: FilterOp.ltU32Batch,
      ltBatchSmall: FilterOp.ltU32BatchSmall,
      ge: FilterOp.geU32,
      geBatch: FilterOp.geU32Batch,
      geBatchSmall: FilterOp.geU32BatchSmall,
      le: FilterOp.leU32,
      leBatch: FilterOp.leU32Batch,
      leBatchSmall: FilterOp.leU32BatchSmall,
    },
  },
}

const getFilterOp = (
  propDef: PropDef | PropDefEdge,
  typeCfg: (typeof getProps)[keyof typeof getProps],
  operator: Operator,
  len: number,
): {
  len: number
  op: FilterOpEnum
  write: (condition: Uint8Array, v: any, offset: number) => Uint8Array
} => {
  if (
    operator === '=' ||
    operator === '<' ||
    operator === '>' ||
    operator === '<=' ||
    operator === '>='
  ) {
    // add NEQ
    const vectorLen = 16 / propDef.len
    let opName: 'eq' | 'gt' | 'lt' | 'ge' | 'le' = 'eq'
    if (operator === '<') opName = 'lt'
    else if (operator === '>') opName = 'gt'
    else if (operator === '<=') opName = 'le'
    else if (operator === '>=') opName = 'ge'

    if (len > vectorLen) {
      return {
        op: typeCfg.ops[`${opName}Batch`],
        len: propDef.len,
        write: typeCfg.write,
      }
    } else if (len > 1) {
      return {
        op: typeCfg.ops[`${opName}BatchSmall`],
        len: propDef.len,
        write: typeCfg.write,
      }
    } else {
      return {
        op: typeCfg.ops[opName],
        len: propDef.len,
        write: typeCfg.write,
      }
    }
  } else if (operator === '..') {
    return {
      op: typeCfg.ops.range,
      len: propDef.len * 2,
      write: (condition: Uint8Array, v: any, offset: number) => {
        // x >= 3 && x <= 11
        // (x -% 3) <= (11 - 3)
        typeCfg.write(condition, v[0], offset)
        typeCfg.write(condition, v[1] - v[0], offset + propDef.len)
        return condition
      },
    }
  }
  throw new Error(`Op ${operator} not implemented yet...`)
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
    const { op, len, write } = getFilterOp(
      propDef,
      typeCfg,
      operator,
      value.length,
    )
    const vectorLen = 16 / len

    if (value.length == 1 || operator === '..' || operator == '!..') {
      const { condition, offset } = conditionBuffer(
        { ...propDef, start: propDef.start || 0 },
        len,
        op,
      )
      if (operator === '..' || operator == '!..') {
        write(condition, value, offset)
      } else {
        write(condition, value[0], offset)
      }
      return condition
    } else if (value.length > vectorLen) {
      const { condition, offset } = conditionBuffer(
        { ...propDef, start: propDef.start || 0 },
        value.length * len,
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
        i += len
      }
      return condition
    } else if (value.length > 1) {
      // Small batch
      const { condition, offset } = conditionBuffer(
        { ...propDef, start: propDef.start || 0 },
        value.length * len,
        op,
      )
      let i = offset
      for (let j = 0; j < vectorLen; j++) {
        // Allways use a full ARM neon simd vector (16 bytes)
        write(condition, j >= value.length ? value[0] : value[j], i)
        i += len
      }
      return condition
    }
  }
}
