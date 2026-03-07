import native from '../../../native.js'
import { PropDef } from '../../../schema/defs/index.js'
import { canBitwiseLowerCase } from '../../../utils/canBitwiseLowerCase.js'
import { ENCODER, writeUint32 } from '../../../utils/uint8.js'
import { FilterOpCompare as Op } from '../../../zigTsExports.js'
import { FilterOpts, Operator } from '../ast.js'
import { createCondition } from './condition.js'
import { isFixedLenString, operatorToEnum } from './operatorToEnum.js'

export const variableComparison = (
  prop: PropDef,
  operator: Operator,
  val: any[],
  opts?: FilterOpts,
) => {
  let op = operatorToEnum(operator)

  if (op === Op.eq || op === Op.neq) {
    if (isFixedLenString(prop)) {
      if (val.length > 1) {
        op = op === Op.neq ? Op.neqVarBatch : Op.eqVarBatch
      } else {
        op = op === Op.neq ? Op.neqVar : Op.eqVar
      }
    } else if (prop.size === 0) {
      op = op === Op.neq ? Op.neqCrc32 : Op.eqCrc32
    }
  }

  if (op === Op.like || op === Op.nlike) {
    const value = val[0].normalize('NFKD')
    const size = native.stringByteLength(value)
    const { condition, offset } = createCondition(prop, op, size, 0)
    ENCODER.encodeInto(value, condition.subarray(offset))
    return condition
  }

  if (op === Op.inc || op === Op.ninc) {
    let value: string
    if (opts?.lowerCase) {
      value = val[0].toLowerCase().normalize('NFKD')
      if (canBitwiseLowerCase(value)) {
        op = Op.inc ? Op.incLcaseFast : Op.nincLcaseFast
      } else {
        op = Op.ninc ? Op.incLcase : Op.nincLcase
      }
    } else {
      value = val[0].normalize('NFKD')
    }
    const size = native.stringByteLength(value)
    const { condition, offset } = createCondition(prop, op, size, 0)
    ENCODER.encodeInto(value, condition.subarray(offset))
    return condition
  }

  if (op === Op.eqVar || op === Op.neqVar) {
    const value = val[0].normalize('NFKD')
    const size = native.stringByteLength(value)
    const { condition, offset } = createCondition(prop, op, size, 0)
    ENCODER.encodeInto(value, condition.subarray(offset))
    return condition
  }

  if (op === Op.eqCrc32 || op === Op.neqCrc32) {
    const { condition, offset } = createCondition(prop, op, 8, 4)
    const buf = ENCODER.encode(val[0].normalize('NFKD'))
    writeUint32(condition, native.crc32(buf), offset)
    writeUint32(condition, buf.byteLength, offset + 4)
    return condition
  }

  if (op === Op.eqVarBatch || op === Op.neqVarBatch) {
    let size = 0
    const values: string[] = []
    for (const v of val) {
      const value = v.normalize('NFKD')
      values.push(value)
      size += native.stringByteLength(value) + 1 // 1 extra for string size
    }
    const { condition, offset } = createCondition(prop, op, size, 0)
    let i = offset
    for (const value of values) {
      const size = ENCODER.encodeInto(value, condition.subarray(i + 1)).written
      condition[i] = size
      i += size + 1
    }
    return condition
  }

  throw new Error(
    `Filter comparison not supported "${operator}" ${prop.path.join('.')}`,
  )
}
