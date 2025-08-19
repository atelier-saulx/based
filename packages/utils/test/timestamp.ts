import test from 'ava'
import { convertToTimestamp, wait } from '../src/index.js'

const MS_IN_SECOND = 1000
const MS_IN_MINUTE = 60 * MS_IN_SECOND
const MS_IN_HOUR = 60 * MS_IN_MINUTE
const MS_IN_DAY = 24 * MS_IN_HOUR
const MS_IN_YEAR = 31556952000

test('convertToTimestamp - Date object', (t) => {
  const date = new Date()
  const timestamp = date.valueOf()
  t.is(convertToTimestamp(date), timestamp)
})

test('convertToTimestamp - number (timestamp)', (t) => {
  const timestamp = 1678886400000
  t.is(convertToTimestamp(timestamp), timestamp)
})

test('convertToTimestamp - string "now"', async (t) => {
  const before = Date.now()
  await wait(1)
  const result = convertToTimestamp('now')
  await wait(1)
  const after = Date.now()
  t.true(result >= before && result <= after)
})

test('convertToTimestamp - ISO date string', (t) => {
  const dateStr = '2023-03-15T12:00:00.000Z'
  const expectedTimestamp = new Date(dateStr).valueOf()
  t.is(convertToTimestamp(dateStr), expectedTimestamp)
})

test('convertToTimestamp - simple date string', (t) => {
  const dateStr = '2023-03-15'
  const expectedTimestamp = new Date(dateStr).valueOf()
  t.is(convertToTimestamp(dateStr), expectedTimestamp)
})

test('convertToTimestamp - relative time string (seconds)', async (t) => {
  const now = Date.now()
  const result = convertToTimestamp('now+5s')

  t.true(
    result >= now + 5 * MS_IN_SECOND - 1 &&
      result < now + 5 * MS_IN_SECOND + 100
  )

  const result2 = convertToTimestamp('now-10s')
  t.true(
    result2 <= now - 10 * MS_IN_SECOND + 1 &&
      result2 > now - 10 * MS_IN_SECOND - 100
  )
})

test('convertToTimestamp - relative time string (minutes)', async (t) => {
  const now = Date.now()
  const result = convertToTimestamp('now+2m')
  t.true(
    result >= now + 2 * MS_IN_MINUTE - 1 &&
      result < now + 2 * MS_IN_MINUTE + 100
  )

  const result2 = convertToTimestamp('now-3m')
  t.true(
    result2 <= now - 3 * MS_IN_MINUTE + 1 &&
      result2 > now - 3 * MS_IN_MINUTE - 100
  )
})

test('convertToTimestamp - relative time string (hours)', async (t) => {
  const now = Date.now()
  const result = convertToTimestamp('now+1h')
  t.true(result >= now + MS_IN_HOUR - 1 && result < now + MS_IN_HOUR + 100)

  const result2 = convertToTimestamp('now-4h')
  t.true(
    result2 <= now - 4 * MS_IN_HOUR + 1 && result2 > now - 4 * MS_IN_HOUR - 100
  )
})

test('convertToTimestamp - relative time string (days)', async (t) => {
  const now = Date.now()
  const result = convertToTimestamp('now+3d')
  t.true(
    result >= now + 3 * MS_IN_DAY - 1 && result < now + 3 * MS_IN_DAY + 100
  )

  const result2 = convertToTimestamp('now-1d')
  t.true(result2 <= now - MS_IN_DAY + 1 && result2 > now - MS_IN_DAY - 100)
})

test('convertToTimestamp - relative time string (years)', async (t) => {
  const now = Date.now()
  const result = convertToTimestamp('now+1y')
  t.true(result >= now + MS_IN_YEAR - 1 && result < now + MS_IN_YEAR + 100)

  const result2 = convertToTimestamp('now-2y')
  t.true(
    result2 <= now - 2 * MS_IN_YEAR + 1 && result2 > now - 2 * MS_IN_YEAR - 100
  )
})

test('convertToTimestamp - combined relative time string', async (t) => {
  const now = Date.now()
  const expectedOffset =
    1 * MS_IN_DAY - 2 * MS_IN_HOUR + 30 * MS_IN_MINUTE + 15 * MS_IN_SECOND
  const result = convertToTimestamp('now+1d-2h+30m+15s')

  t.true(
    result >= now + expectedOffset - 5 && result < now + expectedOffset + 100
  )
})

test('convertToTimestamp - absolute date + relative time', (t) => {
  const dateStr = '2023-01-01T00:00:00.000Z'
  const baseTimestamp = new Date(dateStr).valueOf()
  const expectedTimestamp = baseTimestamp + 2 * MS_IN_DAY
  t.is(convertToTimestamp(`${dateStr}+2d`), expectedTimestamp)
})

test('convertToTimestamp - relative time without "now"', (t) => {
  const expected = MS_IN_DAY
  t.is(convertToTimestamp('+1d'), expected)

  const expected2 = MS_IN_HOUR - 5 * MS_IN_MINUTE
  t.is(convertToTimestamp('+1h-5m'), expected2)

  const expected3 = -MS_IN_YEAR
  t.is(convertToTimestamp('-1y'), expected3)
})

test('convertToTimestamp - invalid string input', (t) => {
  t.true(isNaN(convertToTimestamp('invalid date string')))
  t.true(isNaN(convertToTimestamp('now+5x')))
  t.is(convertToTimestamp(''), 0)
  t.is(convertToTimestamp('+ -'), 0)
})

test('convertToTimestamp - multiple now instances', async (t) => {
  const result = convertToTimestamp('now+1s-now')
  t.true(
    result > MS_IN_SECOND - 50 && result < MS_IN_SECOND + 50,
    `Result was ${result}`
  )
})
