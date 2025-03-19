import { QueryDef, AggFn } from './types.js'

export const createAggFnBuffer = (aggregation: AggFn) => {
  const buf = new Uint8Array(1)
  buf[0] = aggregation
  return buf
}

export const count = (def: QueryDef) => {
  def.aggregation = AggFn.COUNT
}
