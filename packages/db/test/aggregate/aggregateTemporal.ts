import { equal } from 'node:assert'
import { BasedDb } from '../../src/index.js'
import { allCountryCodes } from '../shared/examples.js'
import test from '../shared/test.js'
import { throws, deepEqual } from '../shared/assert.js'
import { fastPrng } from '@based/utils'

await test('group by datetime intervals', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      trip: {
        pickup: 'timestamp',
        dropoff: 'timestamp',
        distance: 'number',
        vendorId: 'uint16',
      },
    },
  })

  db.create('trip', {
    vendorId: 813,
    pickup: new Date('12/11/2024 11:00+00'),
    dropoff: new Date('12/11/2024 11:10+00'),
    distance: 513.44,
  })
  db.create('trip', {
    vendorId: 814,
    pickup: new Date('12/11/2024 11:30+00'),
    dropoff: new Date('12/12/2024 12:10+00'),
    distance: 513.44,
  })

  deepEqual(
    await db.query('trip').sum('distance').groupBy('pickup', 'day').get(),
    {
      11: {
        distance: { sum: 1026.88 },
      },
    },
    'shorthand for step type',
  )
  deepEqual(
    await db
      .query('trip')
      .sum('distance')
      .groupBy('pickup', { step: 'day' })
      .get(),
    {
      11: {
        distance: { sum: 1026.88 },
      },
    },
    'group timestamp by day, without shorthand',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('pickup', 'hour').get(),
    {
      11: {
        distance: { sum: 1026.88 },
      },
    },
    'group timestamp by hour',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('pickup', 'dow').get(),
    {
      3: {
        distance: { sum: 1026.88 },
      },
    },
    'group timestamp by day of week',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('pickup', 'isoDOW').get(),
    {
      3: {
        distance: { sum: 1026.88 },
      },
    },
    'group timestamp by hour',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('pickup', 'doy').get(),
    {
      345: {
        distance: { sum: 1026.88 },
      },
    },
    'group timestamp by hour',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('pickup', 'month').get(),
    {
      11: {
        distance: { sum: 1026.88 },
      },
    },
    'group timestamp by month[0-11]',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('pickup', 'year').get(),
    {
      2024: {
        distance: { sum: 1026.88 },
      },
    },
    'group timestamp by hour',
  )
})

await test('group by datetime ranges', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      trip: {
        pickup: 'timestamp',
        dropoff: 'timestamp',
        distance: 'number',
        vendorId: 'uint16',
      },
    },
  })

  db.create('trip', {
    vendorId: 813,
    pickup: new Date('12/11/2024 11:00+00'),
    dropoff: new Date('12/11/2024 11:10+00'),
    distance: 813.44,
  })

  db.create('trip', {
    vendorId: 814,
    pickup: new Date('12/11/2024 11:30+00'),
    dropoff: new Date('12/12/2024 12:10+00'),
    distance: 513.44,
  })

  const dtFormat = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })

  let interval = 40 * 60 // 40 minutes
  let r = await db
    .query('trip')
    .sum('distance')
    .groupBy('pickup', interval)
    .get()
    .toObject()

  let epoch = Number(Object.keys(r)[0])
  let startDate = dtFormat.format(epoch)
  let endDate = epoch + interval * 1000

  // console.log(r) // epoch as index
  deepEqual(
    r,
    { '1733914800000': { distance: { sum: 1326.88 } } },
    'epoch as index',
  )

  const startDateAsIndex = { [startDate]: Object.values(r)[0] }
  // console.log(startDateAsIndex) // startDate as index
  deepEqual(
    startDateAsIndex,
    { '11/12/2024, 08:00': { distance: { sum: 1326.88 } } },
    'startDate as index',
  )
  const rangeAsIndex = {
    [dtFormat.formatRange(epoch, endDate)]: Object.values(r)[0],
  }
  // console.log(rangeAsIndex) // range as index
  deepEqual(
    rangeAsIndex,
    { '11/12/2024 08:00 – 08:40': { distance: { sum: 1326.88 } } },
    'range as index',
  )

  let interval2 = 60 * 60 * 24 * 12 + 2 * 60 * 60 // 12 days and 2h
  let r2 = await db
    .query('trip')
    .sum('distance')
    .groupBy('pickup', interval2)
    .get()
    .toObject()

  let epoch2 = Number(Object.keys(r2)[0])
  let startDate2 = dtFormat.format(epoch2)
  let endDate2 = epoch2 + interval2 * 1000
  const rangeByIndex2 = {
    [dtFormat.formatRange(epoch2, endDate2)]: Object.values(r2)[0],
  }
  // console.log(rangeByIndex2)
  deepEqual(
    rangeByIndex2,
    { '11/12/2024, 08:00 – 23/12/2024, 10:00': { distance: { sum: 1326.88 } } },
    'another range interval as index',
  )

  // ranges are limited to u32 max value seconds => (group by ~136 years intervals)
  await throws(
    async () => {
      await db
        .query('trip')
        .sum('distance')
        .groupBy('pickup', 2 ** 32 + 1)
        .get()
        .inspect()
    },
    false,
    `throw invalid step range error on validation`,
  )
})

await test('cardinality with dates', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      lunch: {
        day: 'timestamp',
        eaters: 'cardinality',
      },
    },
  })

  db.create('lunch', {
    day: new Date('6/30/2025 00:00+0'), // mon
    eaters: ['Tom', 'youzi', 'jimdebeer', 'Victor', 'Luca'],
  })
  db.create('lunch', {
    day: new Date('7/1/2025 00:00+0'), // tue
    eaters: [
      'Nuno',
      'Tom',
      'Alex',
      'Niels',
      'jimdebeer',
      'Francesco',
      'Victor',
    ],
  })
  db.create('lunch', {
    day: '7/2/25', // wed
    eaters: ['Nuno', 'youzi', 'Francesco', 'Victor', 'Luca'],
  })
  db.create('lunch', {
    day: '7/3/25', // thu
    eaters: ['Tom', 'youzi', 'jimdebeer', 'Victor', 'Luca'],
  })
  db.create('lunch', {
    day: '7/4/25', // fri
    eaters: [
      'Nuno',
      'yves',
      'Tom',
      'youzi',
      'jimdebeer',
      'Francesco',
      'Victor',
      'sandor',
      'Luca',
    ],
  })

  const total = await db.query('lunch').cardinality('eaters').get().toObject()

  // console.log('Total Eaters: ', total.eaters)
  deepEqual(total.eaters.cardinality, 11, 'Total Eaters')

  const groupByDay = await db
    .query('lunch')
    .cardinality('eaters')
    .groupBy('day')
    .get()
    .toObject()

  const meals = Object.entries(groupByDay) //@ts-ignore
    .map((m) => m[1].eaters.cardinality)
    .reduce((e, acc) => (acc += e))

  // console.log('Total Meals: ', meals)
  deepEqual(meals, 31, 'Total Meals')

  enum months {
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  }

  const groupByMonth = await db
    .query('lunch')
    .cardinality('eaters')
    .groupBy('day', 'month')
    .get()
    .toObject()

  const eatersByMonth = Object.entries(groupByMonth).map((e) => {
    //@ts-ignore
    return { [months[e[0]]]: e[1].eaters }
  })
  // console.log('Total Eaters by Month: ', eatersByMonth)
  deepEqual(
    eatersByMonth,
    [{ Jun: { cardinality: 5 } }, { Jul: { cardinality: 11 } }],
    'Total Eaters by Month',
  )
})

await test('formating timestamp', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      trip: {
        pickup: 'timestamp',
        dropoff: 'timestamp',
        distance: 'number',
        vendorId: 'uint16',
      },
    },
  })

  db.create('trip', {
    vendorId: 813,
    pickup: new Date('12/11/2024 11:00+00'),
    dropoff: new Date('12/11/2024 11:10+00'),
    distance: 813.44,
  })

  db.create('trip', {
    vendorId: 814,
    pickup: new Date('12/11/2024 11:30+00'),
    dropoff: new Date('12/12/2024 12:10+00'),
    distance: 513.44,
  })

  const dtFormat = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })

  deepEqual(
    await db.query('trip').sum('distance').groupBy('pickup').get(),
    {
      1733916600000: {
        distance: { sum: 513.44 },
      },
      1733914800000: {
        distance: { sum: 813.44 },
      },
    },
    'no format => epoch ',
  )

  deepEqual(
    await db
      .query('trip')
      .sum('distance')
      .groupBy('pickup', { step: 40 * 60, display: dtFormat })
      .get(),
    {
      '11/12/2024 08:00 – 08:40': {
        distance: { sum: 1326.88 },
      },
    },
    'formated range interval as range',
  )

  deepEqual(
    await db
      .query('trip')
      .sum('distance')
      .groupBy('pickup', { display: dtFormat })
      .get(),
    {
      '11/12/2024, 08:30': { distance: { sum: 513.44 } },
      '11/12/2024, 08:00': { distance: { sum: 813.44 } },
    },
    'formated timestamp without range',
  )
})

await test('timezone offsets', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      trip: {
        pickup: 'timestamp',
        dropoff: 'timestamp',
        distance: 'number',
        vendorId: 'uint16',
      },
    },
  })

  db.create('trip', {
    vendorId: 813,
    pickup: new Date('12/11/2024 00:00+00'), // it is 11th Dec midnight in UTC
    dropoff: new Date('12/01/2024 00:01-03'),
    distance: 813.44,
  })

  db.create('trip', {
    vendorId: 814,
    pickup: new Date('12/11/2024 15:30+00'),
    dropoff: new Date('12/01/2024 00:00+00'),
    distance: 513.44,
  })

  const dtFormat = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })

  deepEqual(
    await db
      .query('trip')
      .sum('distance')
      .groupBy('pickup', { step: 'day', timeZone: 'America/Sao_Paulo' })
      .get(),
    {
      10: {
        // it is 10th Dec 21h in São Paulo (depending on DST)
        distance: { sum: 813.44 },
      },
      11: {
        distance: { sum: 513.44 },
      },
    },
    'reading stored datetime (as UTC) with specific timezone',
  )
  deepEqual(
    await db
      .query('trip')
      .sum('distance')
      .groupBy('pickup', { step: 'hour', timeZone: 'America/Sao_Paulo' })
      .get(),
    {
      21: {
        distance: { sum: 813.44 },
      },
      12: {
        distance: { sum: 513.44 },
      },
    },
    'reading stored datetime (as UTC) with specific timezone',
  )
  deepEqual(
    await db
      .query('trip')
      .sum('distance')
      .groupBy('dropoff', { step: 'month', timeZone: 'America/Sao_Paulo' })
      .get(),
    {
      11: {
        // Dec, 0 index
        distance: { sum: 813.44 },
      },
      10: {
        // Nov, 0 index
        distance: { sum: 513.44 },
      },
    },
    'reading stored datetime (as UTC) with specific timezone',
  )
})
