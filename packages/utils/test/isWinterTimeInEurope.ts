import test from 'ava'
import { isWinterTimeInEurope } from '../src/isWinterTimeInEurope.js'

test('is summer time', async (t) => {
  const startDate = new Date('2025-03-30')

  const stopDate = new Date('2025-10-26')

  for (let d = new Date(startDate); d <= stopDate; d.setDate(d.getDate() + 1)) {
    t.false(isWinterTimeInEurope(d))
  }
})
test('is winter time', async (t) => {
  const startDate = new Date('2025-10-26')
  const stopDate = new Date('2026-03-29')

  for (let d = new Date(startDate); d <= stopDate; d.setDate(d.getDate() + 1)) {
    t.true(isWinterTimeInEurope(d))
  }
})
test('some  specific dates', async (t) => {
  const date = new Date('2026-10-18')
  t.false(isWinterTimeInEurope(new Date(Date.UTC(2026, 9, 18))))
  t.true(isWinterTimeInEurope(new Date(Date.UTC(2026, 9, 25))))
  t.true(isWinterTimeInEurope(new Date(Date.UTC(2027, 0, 1))))
  t.false(isWinterTimeInEurope(new Date(Date.UTC(2027, 2, 28))))

  t.false(isWinterTimeInEurope(date))
})
