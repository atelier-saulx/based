import {
  FilterOpCompareEnum,
  FilterOpCompare,
  PropType,
} from '../../../zigTsExports.js'
import { Operator } from '../ast.js'
import { PropDef } from '../../../schema/defs/index.js'

export const operatorToEnum = (
  op: Operator,
  val: any[],
  prop: PropDef,
): FilterOpCompareEnum => {
  const size = prop.size
  const vectorLen = 16 / size

  if (op === '=' && val.length === 1) {
    if (isFixedLenString(prop)) {
      return FilterOpCompare.eqVar
    }
    return FilterOpCompare.eq
  }

  if (op === '=' && val.length > vectorLen) {
    // var batch
    return FilterOpCompare.eqBatch
  }

  if (op === '=' && val.length <= vectorLen) {
    // var batch
    return FilterOpCompare.eqBatchSmall
  }

  if (op === '!=' && val.length === 1) {
    if (isFixedLenString(prop)) {
      return FilterOpCompare.neqVar
    }
    return FilterOpCompare.neq
  }

  if (op === '!=' && val.length > vectorLen) {
    // var batch
    return FilterOpCompare.neqBatch
  }

  if (op === '!=' && val.length <= vectorLen) {
    // var batch
    return FilterOpCompare.neqBatchSmall
  }

  if (op === '>') {
    return FilterOpCompare.gt
  }

  if (op === '>=') {
    return FilterOpCompare.ge
  }

  if (op === '<') {
    return FilterOpCompare.lt
  }

  if (op === '<=') {
    return FilterOpCompare.le
  }

  if (op === 'includes') {
    // var batch
    return FilterOpCompare.inc
  }

  if (op === '!includes') {
    // var batch
    return FilterOpCompare.ninc
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
