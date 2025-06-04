export const enum AggregateType {
  SUM = 1,
  COUNT = 2,
  CARDINALITY = 3,
  STDDEV = 4,
}

export const enum GroupBy {
  NONE = 0,
  HAS_GROUP = 255,
}
