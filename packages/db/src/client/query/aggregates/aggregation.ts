import { QueryDef, AggFlag } from '../types.js'
import {
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  isNumberType,
} from '@based/schema/def'

export const createAggFlagBuffer = (aggregation: AggFlag, field: number) => {
  const buf = new Uint8Array(3)
  buf[0] = aggregation
  buf[1] = field
  buf[2] = field >>> 8
  return buf
}

export const count = (def: QueryDef) => {
  def.aggregation.type = AggFlag.COUNT
}

export const sum = (def: QueryDef, field: string) => {
  def.aggregation.type = AggFlag.SUM
  const prop = def.props[field]
  if (!prop) {
    throw Error('Prop not found!')
  } else if (!isNumberType(prop.typeIndex)) {
    throw Error('Prop must be a number type!')
  }
  def.aggregation.field = prop.prop
}
