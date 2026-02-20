import { FilterOpCompareEnum, FilterOpCompare } from '../../../zigTsExports.js'
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
    return FilterOpCompare.eq
  }

  if (op === '=' && val.length > vectorLen) {
    return FilterOpCompare.eqBatch
  }

  if (op === '=' && val.length <= vectorLen) {
    return FilterOpCompare.eqBatchSmall
  }

  if (op === '!=' && val.length === 1) {
    return FilterOpCompare.neq
  }

  if (op === '!=' && val.length > vectorLen) {
    return FilterOpCompare.neqBatch
  }

  if (op === '!=' && val.length <= vectorLen) {
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
    return FilterOpCompare.inc
  }

  if (op === '!includes') {
    return FilterOpCompare.ninc
  }

  throw new Error(`Unsupported compare operator ${op}`)
}
