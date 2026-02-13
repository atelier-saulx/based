import native from '../../../native.js'
import { PropDef } from '../../../schema/defs/index.js'
import {
  FilterConditionByteSize,
  FilterConditionAlignOf,
  FilterOp,
  FilterOpCompare,
  writeFilterCondition,
  ModifyEnum,
  LangCodeEnum,
  PropType,
} from '../../../zigTsExports.js'
import { FilterOpts, Operator } from '../ast.js'

export const conditionByteSize = (propSize: number, size: number) => {
  return size + FilterConditionByteSize + FilterConditionAlignOf + 1 + propSize
}

// this will be PUSH
export const conditionBuffer = (
  prop: { start: number; id: number; size: number },
  size: number,
  op: FilterOp,
) => {
  const condition = new Uint8Array(conditionByteSize(prop.size, size))
  condition[0] = 255 // Means condition header is not aligned
  const offset =
    writeFilterCondition(
      condition,
      {
        op,
        start: prop.start || 0,
        prop: prop.id,
        fieldSchema: 0,
        len: prop.size,
        offset: 255, // Means value is not aligned
        size: size + prop.size,
      },
      FilterConditionAlignOf + 1,
    ) + prop.size

  return { condition, offset }
}

const opMap: Partial<Record<Operator, keyof typeof FilterOpCompare>> = {
  '=': 'eq',
  '!=': 'neq',
  '>': 'gt',
  '<': 'lt',
  '>=': 'ge',
  '<=': 'le',
  includes: 'inc',
  '!includes': 'ninc',
}

// redo this whole thing

const getFilterOp = (
  prop: PropDef,
  operator: Operator,
  value: any[],
): {
  size: number
  op: FilterOp
  write: (buf: Uint8Array, val: any, offset: number) => void
} => {
  const opName = opMap[operator]

  if (!opName) {
    throw new Error(`un supported op ${operator}`)
  }

  let write = (buf: Uint8Array, val: any, offset: number) => {
    console.log('write', val)
    prop.write(buf, val, offset)
  }

  let size = prop.size
  if (size === 0) {
    if (prop.type === PropType.string) {
      if (value.length === 1) {
        size = native.stringByteLength(value[0])

        console.log('SIZE', size)

        write = (buf: Uint8Array, val: any, offset: number) => {
          const x = new TextEncoder()
          x.encodeInto(val, buf.subarray(offset))
        }
        // opName has to be eqCrc32 if EQ
      }
    }
  }

  if ((opName === 'eq' || opName === 'neq') && value.length > 1) {
    // incBatch, incBatchSmall
    const vectorLen = 16 / size
    if (value.length > vectorLen) {
      return {
        op: {
          compare: FilterOpCompare[`${opName}Batch`],
          prop: prop.type,
        },
        size,
        write,
      }
    } else {
      return {
        op: {
          compare: FilterOpCompare[`${opName}BatchSmall`],
          prop: prop.type,
        },
        size: prop.size,
        write,
      }
    }
  } else if (operator === '..' || operator === '!..') {
    return {
      op: {
        compare: FilterOpCompare.range,
        prop: prop.type,
      },
      size: size * 2,
      write: (condition: Uint8Array, v: any, offset: number) => {
        // x >= 3 && x <= 11
        // (x -% 3) <= (11 - 3)
        prop.write(condition, v[0], offset)
        prop.write(condition, v[1] - v[0], offset + prop.size)
        return condition
      },
    }
  } else {
    return {
      op: {
        compare: FilterOpCompare[opName],
        prop: prop.type,
      },
      size,
      write,
    }
  }
}

export const createCondition = (
  prop: PropDef,
  operator: Operator,
  value?: any,
  opts?: FilterOpts,
) => {
  if (value !== undefined && !(value instanceof Array)) {
    value = [value]
  }

  const { op, size, write } = getFilterOp(prop, operator, value)

  // this is fixed make fixed and variable in a file

  const vectorLen = 16 / size

  if (value.length == 1 || operator === '..' || operator == '!..') {
    const { condition, offset } = conditionBuffer(
      { size: prop.size, start: prop.start, id: prop.id },
      size,
      op,
    )
    if (operator === '..' || operator == '!..') {
      write(condition, value, offset)
    } else {
      write(condition, value[0], offset)
    }
    return condition
  } else if (value.length > vectorLen) {
    // only relevant for eq and neq
    const { condition, offset } = conditionBuffer(prop, value.length * size, op)
    let i = offset
    // Actual values
    for (const v of value) {
      write(condition, v, i)
      i += prop.size
    }
    // Empty padding for SIMD (16 bytes)
    for (let j = 0; j < vectorLen; j++) {
      write(condition, value[0], i)
      i += size
    }
    return condition
  } else if (value.length > 1) {
    // Small batch
    const { condition, offset } = conditionBuffer(prop, value.length * size, op)
    let i = offset
    for (let j = 0; j < vectorLen; j++) {
      // Allways use a full ARM neon simd vector (16 bytes)
      write(condition, j >= value.length ? value[0] : value[j], i)
      i += size
    }
    return condition
  }

  throw new Error('Cannot create filter cond')
}
