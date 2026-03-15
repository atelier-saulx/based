import {
  FilterOpCompareEnum as OpEnum,
  FilterOpCompare as Op,
  PropType,
} from '../../../zigTsExports.js'
import { Operator } from '../ast.js'
import { PropDef } from '../../../schema/defs/index.js'

export const operatorToEnum = (op: Operator): OpEnum => {
  if (op === '=') {
    return Op.eq
  }

  if (op === '!=') {
    return Op.neq
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
    return Op.ninc
  }

  if (op === 'like') {
    return Op.like
  }

  if (op === '!like') {
    return Op.nlike
  }

  throw new Error(`Unsupported compare operator ${op}`)
}

export const isFixedLenString = (prop: PropDef) => {
  return (
    prop.type === PropType.stringFixed ||
    prop.type === PropType.jsonFixed ||
    prop.type === PropType.binaryFixed
  )
}
