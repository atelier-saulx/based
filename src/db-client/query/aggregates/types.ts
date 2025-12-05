import {
  AggFunctionType,
  type AggFunctionTypeEnum,
  type IntervalEnum,
} from '../../../zigTsExports.js'

export const enum AccumulatorSize {
  sum = 8,
  count = 4,
  cardinality = 4,
  stddev = 24, // count (u64) + sum (f64) + sum_sq (f64) = 8 + 8 + 8 = 24
  average = 16, // count (u64) + sum (f64) = 16
  variance = 24, // count (u64) + sum (f64) + sum_sq (f64) = 8 + 8 + 8 = 24
  max = 8,
  min = 8,
  hmean = 16,
}

export const AggFunctionTypeMap = new Map<
  AggFunctionTypeEnum,
  { resultsSize: number; accumulatorSize: number }
>([
  [
    AggFunctionType.cardinality,
    { resultsSize: 4, accumulatorSize: AccumulatorSize.cardinality },
  ],
  [
    AggFunctionType.count,
    { resultsSize: 4, accumulatorSize: AccumulatorSize.count },
  ],
  [
    AggFunctionType.stddev,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.stddev },
  ],
  [
    AggFunctionType.average,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.average },
  ],
  [
    AggFunctionType.hmean,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.hmean },
  ],
  [
    AggFunctionType.variance,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.variance },
  ],
  // Othe types like MAX, MIN, SUM fall in the else case in aggregation.ts 8/8
])

export type StepObject = {
  step?: number | IntervalEnum
  timeZone?: string
  display?: Intl.DateTimeFormat
}

export type StepShorthand = number | IntervalEnum

export type StepInput = StepObject | StepShorthand

export type NormalizedStepObject = {
  step: number | IntervalEnum
}
