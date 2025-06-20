export enum AggregateType {
  SUM = 1,
  COUNT = 2,
  CARDINALITY = 3,
  STDDEV = 4,
}

export const enum AccumulatorSize { // comptime
  SUM = 4,
  COUNT = 4,
  CARDINALITY = 254, // TBD accordinly to sparse or dense modes
  STDDEV = 24, // count (u64) + sum (f64) + sum_sq (f64) = 8 + 8 + 8 = 24
}

export const enum GroupBy {
  NONE = 0,
  HAS_GROUP = 255,
}
