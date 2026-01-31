import { getPropWriter } from '../../../schema/def/utils.js'
import { PropDef } from '../../../schema/defs/index.js'
import {
  FilterConditionByteSize,
  FilterConditionAlignOf,
  FilterOp,
  FilterOpCompare,
  writeFilterCondition,
} from '../../../zigTsExports.js'
import { FilterOpts, Operator } from '../ast.js'

// this will be PUSH
export const conditionBuffer = (
  propDef: { start: number; id: number; size: number },
  size: number,
  op: FilterOp,
) => {
  const condition = new Uint8Array(
    size + FilterConditionByteSize + FilterConditionAlignOf + 1 + propDef.size,
  )
  console.log('COND BUFFER', size, condition)
  condition[0] = 255 // Means condition header is not aligned
  const offset =
    writeFilterCondition(
      condition,
      {
        op,
        start: propDef.start || 0,
        prop: propDef.id,
        fieldSchema: 0,
        len: propDef.size,
        offset: 255, // Means value is not aligned
        size: size + propDef.size,
      },
      FilterConditionAlignOf + 1,
    ) + propDef.size
  return { condition, offset }
}

const opMap: Partial<Record<Operator, keyof typeof FilterOpCompare>> = {
  '=': 'eq',
  '!=': 'neq',
  '>': 'gt',
  '<': 'lt',
  '>=': 'ge',
  '<=': 'le',
}

const getFilterOp = (
  propDef: PropDef,
  write: ReturnType<typeof getPropWriter>,
  operator: Operator,
  size: number,
): {
  size: number
  op: FilterOp
  write: ReturnType<typeof getPropWriter>
} => {
  const opName = opMap[operator]

  if (!opName) {
    throw new Error(`un supported op ${operator}`)
  }

  if ((opName === 'eq' || opName === 'neq') && size > 1) {
    const vectorLen = 16 / propDef.size
    if (size > vectorLen) {
      return {
        op: {
          compare: FilterOpCompare[`${opName}Batch`],
          prop: propDef.type,
        },
        size: propDef.size,
        write,
      }
    } else {
      return {
        op: {
          compare: FilterOpCompare[`${opName}BatchSmall`],
          prop: propDef.type,
        },
        size: propDef.size,
        write,
      }
    }
  } else if (operator === '..' || operator === '!..') {
    return {
      op: {
        compare: FilterOpCompare.range,
        prop: propDef.type,
      },
      size: propDef.size * 2,
      write: (condition: Uint8Array, v: any, offset: number) => {
        // x >= 3 && x <= 11
        // (x -% 3) <= (11 - 3)
        write(condition, v[0], offset)
        write(condition, v[1] - v[0], offset + propDef.size)
        return condition
      },
    }
  } else {
    return {
      op: {
        compare: FilterOpCompare[opName],
        prop: propDef.type,
      },
      size: propDef.size,
      write,
    }
  }
}

export const createCondition = (
  propDef: PropDef,
  operator: Operator,
  value?: any,
  opts?: FilterOpts,
) => {
  if (value !== undefined && !(value instanceof Array)) {
    value = [value]
  }

  const writer = getPropWriter(propDef.type)
  const { op, size, write } = getFilterOp(
    propDef,
    writer,
    operator,
    value.length,
  )

  const vectorLen = 16 / size

  if (value.length == 1 || operator === '..' || operator == '!..') {
    const { condition, offset } = conditionBuffer(
      { size: propDef.size, start: propDef.start, id: propDef.id },
      size,
      op,
    )
    if (operator === '..' || operator == '!..') {
      write(condition, value, offset)
    } else {
      write(condition, value[0], offset)
    }

    console.log('derp', condition)
    return condition
  } else if (value.length > vectorLen) {
    const { condition, offset } = conditionBuffer(
      { ...propDef, start: propDef.start || 0 },
      value.length * size,
      op,
    )
    let i = offset
    // Actual values
    for (const v of value) {
      write(condition, v, i)
      i += propDef.size
    }
    // Empty padding for SIMD (16 bytes)
    for (let j = 0; j < vectorLen; j++) {
      write(condition, value[0], i)
      i += size
    }
    return condition
  } else if (value.length > 1) {
    // Small batch
    const { condition, offset } = conditionBuffer(
      { ...propDef, start: propDef.start || 0 },
      value.length * size,
      op,
    )
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
