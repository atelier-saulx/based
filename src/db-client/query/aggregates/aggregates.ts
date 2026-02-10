import { QueryDef, QueryDefType } from '../types.js'
import { AggFunction } from '../../../zigTsExports.js'

export const isRootCountOnly = (def: QueryDef, filterSize: number) => {
  if (filterSize != 0) {
    return false
  }
  if (def.type !== QueryDefType.Root) {
    return false
  }
  const aggregate = def.aggregate!
  if (aggregate.groupBy) {
    return false
  }
  if (aggregate.aggregates.size !== 1) {
    return false
  }
  if (!aggregate.aggregates.has(255)) {
    return false
  }
  const aggs = aggregate.aggregates.get(255)!
  if (aggs.length !== 1) {
    return false
  }
  if (aggs[0].type !== AggFunction.count) {
    return false
  }
  if (filterSize > 0) {
    return false
  }
  return true
}

export const getTimeZoneOffsetInMinutes = (
  timeZone: string,
  date: Date = new Date(),
): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const getPart = (partName: string) =>
    parseInt(parts.find((p) => p.type === partName)?.value || '0', 10)

  const targetTimeAsUTC = Date.UTC(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    getPart('hour'),
    getPart('minute'),
    getPart('second'),
  )

  const originalUTCTime = date.getTime()
  const offsetInMilliseconds = targetTimeAsUTC - originalUTCTime
  const offsetInMinutes = offsetInMilliseconds / (1000 * 60)

  return Math.round(offsetInMinutes)
}
