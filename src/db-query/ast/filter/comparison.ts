import native from '../../../native.js'
import { PropDef } from '../../../schema/defs/index.js'
import { ENCODER } from '../../../utils/uint8.js'
import {
  FilterConditionByteSize,
  FilterConditionAlignOf,
  writeFilterCondition,
  PropTypeEnum,
  FilterOpCompareEnum,
  FilterOpCompare,
  PropType,
} from '../../../zigTsExports.js'
import { FilterOpts, Operator } from '../ast.js'
import { isFixedLenString, operatorToEnum } from './operatorToEnum.js'

export const conditionByteSize = (propSize: number, size: number) => {
  return size + FilterConditionByteSize + FilterConditionAlignOf + 1 + propSize
}

// Make this configurable in the client
// has to be send from the server
const VECTOR_BYTES = 16

export const createCondition = (
  prop: { start: number; id: number; size: number; type: PropTypeEnum },
  op: FilterOpCompareEnum,
  size: number = prop.size,
  propSize: number = prop.size,
) => {
  const conditionBuffer = new Uint8Array(conditionByteSize(propSize, size))
  conditionBuffer[0] = 255 // Means condition header is not aligned
  const offset =
    writeFilterCondition(
      conditionBuffer,
      {
        op: {
          prop: prop.type,
          compare: op,
        },
        start: prop.start || 0,
        prop: prop.id,
        fieldSchema: 0,
        len: propSize,
        offset: 255, // Means value is not aligned
        size: size + propSize,
      },
      FilterConditionAlignOf + 1,
    ) + propSize
  return { condition: conditionBuffer, offset }
}

export const fixedComparison = (
  prop: PropDef,
  operator: Operator,
  val: any[],
  opts?: FilterOpts,
) => {
  const op = operatorToEnum(operator, val, prop)

  if (op === FilterOpCompare.eqBatch || op === FilterOpCompare.neqBatch) {
    const size = val.length * prop.size
    const empty = VECTOR_BYTES - (size % VECTOR_BYTES)
    const rest = empty / prop.size
    const { condition, offset } = createCondition(prop, op, size + empty)
    let i = offset
    for (const v of val) {
      prop.write(condition, v, i)
      i += prop.size
    }
    for (let j = 0; j < rest; j++) {
      prop.write(condition, val[0], i)
      i += prop.size
    }
    return condition
  }

  if (
    op === FilterOpCompare.eqBatchSmall ||
    op === FilterOpCompare.neqBatchSmall
  ) {
    const vectorLen = VECTOR_BYTES / prop.size
    const { condition, offset } = createCondition(prop, op, VECTOR_BYTES)
    let i = offset
    for (let j = 0; j < vectorLen; j++) {
      prop.write(condition, j >= val.length ? val[0] : val[j], i)
      i += prop.size
    }
    return condition
  }

  if (op === FilterOpCompare.range || op === FilterOpCompare.nrange) {
    const { condition, offset } = createCondition(prop, op, prop.size * 2)
    prop.write(condition, val[0], offset)
    prop.write(condition, val[1] - val[0], offset + prop.size)
    return condition
  }

  const { condition, offset } = createCondition(prop, op)
  prop.write(condition, val[0], offset)
  return condition
}

export const variableComparison = (
  prop: PropDef,
  operator: Operator,
  val: any[],
  opts?: FilterOpts,
) => {
  const op = operatorToEnum(operator, val, prop)

  if (
    op === FilterOpCompare.inc ||
    op === FilterOpCompare.ninc ||
    op === FilterOpCompare.eqVar ||
    FilterOpCompare.neqVar
  ) {
    if (val.length === 1) {
      const size = native.stringByteLength(val[0])
      // console.log({ size })
      const { condition, offset } = createCondition(prop, op, size, 0)
      ENCODER.encodeInto(val[0], condition.subarray(offset))
      console.log('yo yo yo', val[0], condition, condition.subarray(offset))
      return condition
    } else {
      // fix this
    }
  }

  // else if (op === FilterOpCompare.eqVar || FilterOpCompare.neqVar) {
  // }

  throw new Error(
    `Filter comparison not supported "${operator}" ${prop.path.join('.')}`,
  )
}

export const comparison = (
  prop: PropDef,
  op: Operator,
  val: any,
  opts?: FilterOpts,
) => {
  if (!Array.isArray(val)) {
    val = [val]
  }
  if (prop.size > 0 && !isFixedLenString(prop)) {
    return fixedComparison(prop, op, val, opts)
  }
  return variableComparison(prop, op, val, opts)
}
