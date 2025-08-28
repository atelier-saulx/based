import { AggregateType } from '@based/protocol/db-read'

export const enum AccumulatorSize {
  // comptime
  SUM = 8,
  COUNT = 4,
  CARDINALITY = 4,
  STDDEV = 24, // count (u64) + sum (f64) + sum_sq (f64) = 8 + 8 + 8 = 24
  AVERAGE = 16, // count (u64) + sum (f64) = 16
  VARIANCE = 24, // count (u64) + sum (f64) + sum_sq (f64) = 8 + 8 + 8 = 24
  MAX = 8,
  MIN = 8,
  HMEAN = 16,
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
    AggregateType.HMEAN,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.HMEAN },
  ],
  [
    AggregateType.VARIANCE,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.VARIANCE },
  ],
  // Othe types like MAX, MIN, SUM fall in the else case in aggregation.ts 8/8
])

export const enum GroupBy {
  NONE = 0,
  HAS_GROUP = 255,
}

export enum Interval {
  none = 0,
  epoch = 1,
  hour = 2,
  // minute = 3,
  // second = 4,
  // microseconds = 5,
  day = 6, // The day of the month (1–31); for interval values, the number of days
  doy = 7, // The day of the year (0–365)
  dow = 8, // The day of the week as Sunday (0) to Saturday (6)
  isoDOW = 9, // The day of the week as Monday (1) to Sunday (7). This matches the ISO 8601 day of the week numbering.
  // week = 10, // The number of the ISO 8601 week-numbering week of the year
  month = 11, // The number of the month within the year (0–11);
  // isoMonth = 12, // The number of the month within the year (1–12);
  // quarter = 13, // The quarter of the year (1–4) that the date is in
  year = 14,
  // timeZone = 15, // ? seconds? or string?
}

export type IntervalString = keyof typeof Interval

export type StepObject = {
  step?: number | IntervalString
  timeZone?: string
  display?: Intl.DateTimeFormat
}

export type StepShorthand = number | IntervalString

export type StepInput = StepObject | StepShorthand

export type NormalizedStepObject = {
  step: number | Interval
}

export enum setMode {
  'sample',
  'population',
}

export type setModeString = 'sample' | 'population'

export type aggFnOptions = {
  mode?: setModeString
}
