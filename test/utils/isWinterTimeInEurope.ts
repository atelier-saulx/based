import assert from 'node:assert'
import { test } from '../shared/index.js'
import { isWinterTimeInEurope } from '../../src/utils/index.js'

await test('is summer time', async (t) => {
  const startDate = new Date('2025-03-30')

  const stopDate = new Date('2025-10-26')

  for (let d = new Date(startDate); d <= stopDate; d.setDate(d.getDate() + 1)) {
    assert(!isWinterTimeInEurope(d))
  }
})
await test('is winter time', async (t) => {
  const startDate = new Date('2025-10-26')
  const stopDate = new Date('2026-03-29')

  for (let d = new Date(startDate); d <= stopDate; d.setDate(d.getDate() + 1)) {
    assert(isWinterTimeInEurope(d))
  }
})
await test('some  specific dates', async (t) => {
  const date = new Date('2026-10-18')
  assert(!isWinterTimeInEurope(new Date(Date.UTC(2026, 9, 18))))
  assert(isWinterTimeInEurope(new Date(Date.UTC(2026, 9, 25))))
  assert(isWinterTimeInEurope(new Date(Date.UTC(2027, 0, 1))))
  assert(!isWinterTimeInEurope(new Date(Date.UTC(2027, 2, 28))))

  assert(!isWinterTimeInEurope(date))
})
