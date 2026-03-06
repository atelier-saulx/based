import {
  FilterOpCompareEnum as OpEnum,
  FilterOpCompare as Op,
  PropType,
} from '../../../zigTsExports.js'
import { Operator } from '../ast.js'
import { PropDef } from '../../../schema/defs/index.js'
import { canBitwiseLowerCase } from '../../../utils/canBitwiseLowerCase.js'

export const operatorToEnum = (
  op: Operator,
  val: any[],
  prop: PropDef,
): OpEnum => {
  const size = prop.size
  const vectorLen = 16 / size

  if (op === '=' && val.length === 1) {
    return Op.eq
  }

  if (op === '=' && val.length > vectorLen) {
    // var batch
    return Op.eqBatch
  }

  if (op === '=' && val.length <= vectorLen) {
    // var batch
    return Op.eqBatchSmall
  }

  if (op === '!=' && val.length === 1) {
    return Op.neq
  }

  if (op === '!=' && val.length > vectorLen) {
    // var batch
    return Op.neqBatch
  }

  if (op === '!=' && val.length <= vectorLen) {
    // var batch
    return Op.neqBatchSmall
  }

  if (op === '>') {
    return Op.gt
  }

  if (op === '>=') {
    return Op.ge
  }

  if (op === '<') {
    return Op.lt
  }

  if (op === '<=') {
    return Op.le
  }

  if (op === 'includes') {
    return Op.inc
  }

  if (op === '!includes') {
    // var batch
    return Op.ninc
  }

  throw new Error(`Unsupported compare operator ${op}`)
}

export const isFixedLenString = (prop: PropDef) => {
  return (
    prop.type === PropType.stringFixed ||
    prop.type === PropType.jsonFixed ||
    prop.type == PropType.binaryFixed
  )
}
