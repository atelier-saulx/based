export enum AggregateType {
  SUM = 1,
  COUNT = 2,
  CARDINALITY = 3,
  STDDEV = 4,
  AVERAGE = 5,
  VARIANCE = 6,
  MAX = 7,
  MIN = 8,
}

export const enum AccumulatorSize { // comptime
  SUM = 4,
  COUNT = 4,
  CARDINALITY = 254, // TODO: accordinly to sparse or dense modes
  STDDEV = 24, // count (u64) + sum (f64) + sum_sq (f64) = 8 + 8 + 8 = 24
  AVERAGE = 16, // count (u64) + sum (f64) = 16
  VARIANCE = 24, // count (u64) + sum (f64) + sum_sq (f64) = 8 + 8 + 8 = 24
  MAX = 4,
  MIN = 4,
}

export const aggregateTypeMap = new Map<
  AggregateType,
  { resultsSize: number; accumulatorSize: number }
>([
  [
    AggregateType.CARDINALITY,
    { resultsSize: 4, accumulatorSize: AccumulatorSize.CARDINALITY },
  ],
  [
    AggregateType.COUNT,
    { resultsSize: 4, accumulatorSize: AccumulatorSize.COUNT },
  ],
  [
    AggregateType.STDDEV,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.STDDEV },
  ],
  [
    AggregateType.AVERAGE,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.AVERAGE },
  ],
  [
    AggregateType.VARIANCE,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.VARIANCE },
  ],
  // Othe types like MAX, MIN, SUM should fall in the else case, respecting the prop.typeIndex size
])

export const enum GroupBy {
  NONE = 0,
  HAS_GROUP = 255,
}
