import assert from 'node:assert'
import { convertToTimestamp, wait } from '../../src/utils/index.js'
import { equal, test } from '../shared/index.js'

const MS_IN_SECOND = 1000
const MS_IN_MINUTE = 60 * MS_IN_SECOND
const MS_IN_HOUR = 60 * MS_IN_MINUTE
const MS_IN_DAY = 24 * MS_IN_HOUR
const MS_IN_YEAR = 31556952000

await test('convertToTimestamp - Date object', async (t) => {
  const date = new Date()
  const timestamp = date.valueOf()
  equal(convertToTimestamp(date), timestamp)
})

await test('convertToTimestamp - number (timestamp)', async (t) => {
  const timestamp = 1678886400000
  equal(convertToTimestamp(timestamp), timestamp)
})

await test('convertToTimestamp - string "now"', async (t) => {
  const before = Date.now()
  await wait(1)
  const result = convertToTimestamp('now')
  await wait(1)
  const after = Date.now()
  assert(result >= before && result <= after)
})

await test('convertToTimestamp - ISO date string', async (t) => {
  const dateStr = '2023-03-15T12:00:00.000Z'
  const expectedTimestamp = new Date(dateStr).valueOf()
  equal(convertToTimestamp(dateStr), expectedTimestamp)
})

await test('convertToTimestamp - simple date string', async (t) => {
  const dateStr = '2023-03-15'
  const expectedTimestamp = new Date(dateStr).valueOf()
  equal(convertToTimestamp(dateStr), expectedTimestamp)
})

await test('convertToTimestamp - relative time string (seconds)', async (t) => {
  const now = Date.now()
  const result = convertToTimestamp('now+5s')

  assert(
    result >= now + 5 * MS_IN_SECOND - 1 &&
      result < now + 5 * MS_IN_SECOND + 100,
  )

  const result2 = convertToTimestamp('now-10s')
  assert(
    result2 <= now - 10 * MS_IN_SECOND + 1 &&
      result2 > now - 10 * MS_IN_SECOND - 100,
  )
})

await test('convertToTimestamp - relative time string (minutes)', async (t) => {
  const now = Date.now()
  const result = convertToTimestamp('now+2m')
  assert(
    result >= now + 2 * MS_IN_MINUTE - 1 &&
      result < now + 2 * MS_IN_MINUTE + 100,
  )

  const result2 = convertToTimestamp('now-3m')
  assert(
    result2 <= now - 3 * MS_IN_MINUTE + 1 &&
      result2 > now - 3 * MS_IN_MINUTE - 100,
  )
})

await test('convertToTimestamp - relative time string (hours)', async (t) => {
  const now = Date.now()
  const result = convertToTimestamp('now+1h')
  assert(result >= now + MS_IN_HOUR - 1 && result < now + MS_IN_HOUR + 100)

  const result2 = convertToTimestamp('now-4h')
  assert(
    result2 <= now - 4 * MS_IN_HOUR + 1 && result2 > now - 4 * MS_IN_HOUR - 100,
  )
})

await test('convertToTimestamp - relative time string (days)', async (t) => {
  const now = Date.now()
  const result = convertToTimestamp('now+3d')
  assert(
    result >= now + 3 * MS_IN_DAY - 1 && result < now + 3 * MS_IN_DAY + 100,
  )

  const result2 = convertToTimestamp('now-1d')
  assert(result2 <= now - MS_IN_DAY + 1 && result2 > now - MS_IN_DAY - 100)
})

await test('convertToTimestamp - relative time string (years)', async (t) => {
  const now = Date.now()
  const result = convertToTimestamp('now+1y')
  assert(result >= now + MS_IN_YEAR - 1 && result < now + MS_IN_YEAR + 100)

  const result2 = convertToTimestamp('now-2y')
  assert(
    result2 <= now - 2 * MS_IN_YEAR + 1 && result2 > now - 2 * MS_IN_YEAR - 100,
  )
})

await test('convertToTimestamp - combined relative time string', async (t) => {
  const now = Date.now()
  const expectedOffset =
    1 * MS_IN_DAY - 2 * MS_IN_HOUR + 30 * MS_IN_MINUTE + 15 * MS_IN_SECOND
  const result = convertToTimestamp('now+1d-2h+30m+15s')

  assert(
    result >= now + expectedOffset - 5 && result < now + expectedOffset + 100,
  )
})

await test('convertToTimestamp - absolute date + relative time', async (t) => {
  const dateStr = '2023-01-01T00:00:00.000Z'
  const baseTimestamp = new Date(dateStr).valueOf()
  const expectedTimestamp = baseTimestamp + 2 * MS_IN_DAY
  equal(convertToTimestamp(`${dateStr}+2d`), expectedTimestamp)
})

await test('convertToTimestamp - relative time without "now"', async (t) => {
  const expected = MS_IN_DAY
  equal(convertToTimestamp('+1d'), expected)

  const expected2 = MS_IN_HOUR - 5 * MS_IN_MINUTE
  equal(convertToTimestamp('+1h-5m'), expected2)

  const expected3 = -MS_IN_YEAR
  equal(convertToTimestamp('-1y'), expected3)
})

await test('convertToTimestamp - invalid string input', async (t) => {
  assert(isNaN(convertToTimestamp('invalid date string')))
  assert(isNaN(convertToTimestamp('now+5x')))
  equal(convertToTimestamp(''), 0)
  equal(convertToTimestamp('+ -'), 0)
})

await test('convertToTimestamp - multiple now instances', async (t) => {
  const result = convertToTimestamp('now+1s-now')
  assert(
    result > MS_IN_SECOND - 50 && result < MS_IN_SECOND + 50,
    `Result was ${result}`,
  )
})
