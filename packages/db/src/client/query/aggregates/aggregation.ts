import { QueryDef, AggFlag } from '../types.js'

export const createAggFlagBuffer = (aggregation: AggFlag) => {
  const buf = new Uint8Array(1)
  buf[0] = aggregation
  return buf
}

export const count = (def: QueryDef) => {
  def.aggregation = AggFlag.COUNT
}

export const sum = (def: QueryDef) => {
  def.aggregation = AggFlag.SUM
}
