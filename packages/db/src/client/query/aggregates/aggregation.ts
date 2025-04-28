import { QueryDef, AggFlag } from '../types.js'

export const count = (def: QueryDef) => {
  def.aggregation = AggFlag.COUNT
}

export const sum = (def: QueryDef) => {
  def.aggregation = AggFlag.SUM
}
