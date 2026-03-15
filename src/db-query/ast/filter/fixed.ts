import { PropDef } from '../../../schema/defs/index.js'
import { FilterOpCompare as Op } from '../../../zigTsExports.js'
import { FilterOpts, Operator } from '../ast.js'
import { createCondition } from './condition.js'
import { operatorToEnum } from './operatorToEnum.js'

const VECTOR_BYTES = 16

export const fixedComparison = (
  prop: PropDef,
  operator: Operator,
  val: any[],
  opts?: FilterOpts,
) => {
  let op = operatorToEnum(operator)

  const size = prop.size
  const vectorLen = 16 / size

  if (op === Op.eq || op === Op.neq) {
    if (val.length > vectorLen) {
      op = op === Op.neq ? Op.neqBatch : Op.eqBatch
    } else if (val.length > 1) {
      op = op === Op.neq ? Op.neqBatchSmall : Op.eqBatchSmall
    }
  }

  if (op === Op.eqBatch || op === Op.neqBatch) {
    const size = val.length * prop.size
    const empty = VECTOR_BYTES - (size % VECTOR_BYTES)
    const rest = empty / prop.size
    const { condition, offset } = createCondition(
      prop,
      op,
      size + empty,
      VECTOR_BYTES,
    )
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

  if (op === Op.eqBatchSmall || op === Op.neqBatchSmall) {
    const vectorLen = VECTOR_BYTES / prop.size
    const { condition, offset } = createCondition(
      prop,
      op,
      VECTOR_BYTES,
      VECTOR_BYTES,
    )
    let i = offset
    for (let j = 0; j < vectorLen; j++) {
      prop.write(condition, j >= val.length ? val[0] : val[j], i)
      i += prop.size
    }
    return condition
  }

  if (op === Op.range || op === Op.nrange) {
    const { condition, offset } = createCondition(prop, op, prop.size * 2)
    prop.write(condition, val[0], offset)
    prop.write(condition, val[1] - val[0], offset + prop.size)
    return condition
  }

  const { condition, offset } = createCondition(prop, op)
  prop.write(condition, val[0], offset)
  return condition
}
