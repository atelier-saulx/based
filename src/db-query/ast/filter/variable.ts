import native from '../../../native.js'
import { PropDef } from '../../../schema/defs/index.js'
import { canBitwiseLowerCase } from '../../../utils/canBitwiseLowerCase.js'
import { combineToUint64, ENCODER, writeUint32 } from '../../../utils/uint8.js'
import {
  LangCode,
  LangCodeEnum,
  FilterOpCompare as Op,
  PropType,
} from '../../../zigTsExports.js'
import { FilterOpts, Operator } from '../ast.js'
import { createCondition } from './condition.js'
import { isFixedLenString, operatorToEnum } from './operatorToEnum.js'

const VECTOR_BYTES = 16

export const variableComparison = (
  prop: PropDef,
  operator: Operator,
  val: any[],
  lang: LangCodeEnum,
  opts?: FilterOpts,
) => {
  let op = operatorToEnum(operator)

  for (const v of val) {
    prop.validate(v, lang || LangCode.en)
  }

  if ((op === Op.like || op === Op.nlike) && val.length > 1) {
    const values: string[] = []
    let size = 1
    for (const v of val) {
      const value = v.normalize('NFKD')
      size += native.stringByteLength(value) + 4 // 4 extra for size
      values.push(value)
    }
    op = Op.like ? Op.likeBatch : Op.nlikeBatch
    const minScore = opts?.score ?? 3
    const { condition, offset } = createCondition(prop, op, size, 0, lang)
    condition[offset] = minScore
    let i = offset + 1
    for (const value of values) {
      const size = ENCODER.encodeInto(value, condition.subarray(i + 4)).written
      writeUint32(condition, size, i)
      i += size + 4
    }
    return condition
  }

  if (op === Op.like || op === Op.nlike) {
    const minScore = opts?.score ?? 3
    const value = val[0].normalize('NFKD')
    const size = native.stringByteLength(value) + 1
    const { condition, offset } = createCondition(prop, op, size, 0, lang)
    condition[offset] = minScore
    ENCODER.encodeInto(value, condition.subarray(offset + 1))
    return condition
  }

  if ((op === Op.inc || op === Op.ninc) && val.length > 1) {
    const values: string[] = []
    let size = 0
    if (opts?.lowerCase) {
      let canUseFast = true
      for (const v of val) {
        const value = v.toLowerCase().normalize('NFKD')
        size += native.stringByteLength(value) + 4 // 4 extra for size
        values.push(value)
        if (!canBitwiseLowerCase(value)) {
          canUseFast = false
        }
      }
      if (canUseFast) {
        op = Op.inc ? Op.incBatchLcaseFast : Op.nincBatchLcaseFast
      } else {
        op = Op.inc ? Op.incBatchLcase : Op.nincBatchLcase
      }
    } else {
      for (const v of val) {
        const value = v.normalize('NFKD')
        size += native.stringByteLength(value) + 4 // 4 extra for size
        values.push(value)
      }
      op = Op.inc ? Op.incBatch : Op.nincBatch
    }
    const { condition, offset } = createCondition(prop, op, size, 0, lang)
    let i = offset
    for (const value of values) {
      const size = ENCODER.encodeInto(value, condition.subarray(i + 4)).written
      writeUint32(condition, size, i)
      i += size + 4
    }
    return condition
  }

  if (op === Op.inc || op === Op.ninc) {
    let value: string
    if (opts?.lowerCase) {
      value = val[0].toLowerCase().normalize('NFKD')
      if (canBitwiseLowerCase(value)) {
        op = Op.inc ? Op.incLcaseFast : Op.nincLcaseFast
      } else {
        op = Op.inc ? Op.incLcase : Op.nincLcase
      }
    } else {
      value = val[0].normalize('NFKD')
    }
    const size = native.stringByteLength(value)
    const { condition, offset } = createCondition(prop, op, size, 0, lang)
    ENCODER.encodeInto(value, condition.subarray(offset))
    return condition
  }

  if (
    (op === Op.eq || op === Op.neq) &&
    (isFixedLenString(prop) || prop.type === PropType.alias) &&
    val.length > 1
  ) {
    op = op === Op.eq ? Op.eqVarBatch : Op.neqVarBatch
    let size = 0
    const values: string[] = []
    for (const v of val) {
      const value = v.normalize('NFKD')
      values.push(value)
      size += native.stringByteLength(value) + 1 // 1 extra for string size
    }
    const { condition, offset } = createCondition(prop, op, size, 0, lang)
    let i = offset
    for (const value of values) {
      const size = ENCODER.encodeInto(value, condition.subarray(i + 1)).written
      condition[i] = size
      i += size + 1
    }
    return condition
  }

  if (
    (op === Op.eq || op === Op.neq) &&
    (isFixedLenString(prop) || prop.type === PropType.alias)
  ) {
    op = op === Op.eq ? Op.eqVar : Op.neqVar
    const value = val[0].normalize('NFKD')
    const size = native.stringByteLength(value)
    const { condition, offset } = createCondition(prop, op, size, 0, lang)
    ENCODER.encodeInto(value, condition.subarray(offset))
    return condition
  }

  if ((op === Op.eq || op === Op.neq) && val.length > 1) {
    op = op === Op.eq ? Op.eqCrc32Batch : Op.neqCrc32Batch
    const propSize = 8
    const size = val.length * propSize
    const empty = VECTOR_BYTES - (size % VECTOR_BYTES)
    const rest = empty / propSize
    const { condition, offset } = createCondition(
      prop,
      op,
      size + empty,
      propSize,
      lang,
    )
    let i = offset
    for (const v of val) {
      const buf = ENCODER.encode(v.normalize('NFKD'))
      combineToUint64(condition, native.crc32(buf), buf.byteLength, i)
      i += propSize
    }
    for (let j = 0; j < rest; j++) {
      condition.set(condition.subarray(offset, offset + propSize), i)
      i += propSize
    }
    return condition
  }

  if (op === Op.eq || op === Op.neq) {
    op = op === Op.eq ? Op.eqCrc32 : Op.neqCrc32
    const { condition, offset } = createCondition(prop, op, 8, 4, lang)
    const buf = ENCODER.encode(val[0].normalize('NFKD'))
    writeUint32(condition, native.crc32(buf), offset)
    writeUint32(condition, buf.byteLength, offset + 4)
    return condition
  }

  throw new Error(
    `Filter comparison not supported "${operator}" ${prop.path.join('.')}`,
  )
}
