import { BasedDb, groupBy } from '../../src/db.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('dev', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      lunch: {
        week: 'string',
        lala: 'number',
        lele: 'number',
        Mon: 'cardinality',
        Tue: 'cardinality',
        Wed: 'cardinality',
        Thu: 'cardinality',
        Fri: 'cardinality',
      },
    },
  })

  const week27 = {
    week: '27',
    lala: 250,
    Mon: ['Tom', 'youzi', 'jimdebeer', 'Victor', 'Luca'],
    Tue: ['Nuno', 'Tom', 'Alex', 'Niels', 'jimdebeer', 'Francesco', 'Victor'],
    Wed: ['Nuno', 'youzi', 'Francesco', 'Victor', 'Luca'],
    Thu: [
      'Nuno',
      'yves',
      'Fulco',
      'Tom',
      'Sara',
      'Felix',
      'Thomas',
      'Sebastian',
      'jimdebeer',
      'youzi',
      'Francesco',
      'Victor',
      'sandor',
      'Fabio',
      'Luca',
    ],
    Fri: [
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
  }
  await db.create('lunch', week27)

  // const eaters = await db.query('lunch').get()
  // eaters.inspect()

  // // knwon from raw data:
  // const days = Object.keys(week27).filter((k) => k !== 'week')
  // const meals = days.map((k) => week27[k]).flat()
  // const totalEaters = new Set(meals)
  // console.log(
  //   `From raw data. Total eaters: ${totalEaters.size}, Total meals: ${meals.length}`,
  // )

  // console.log(
  //   'Total meals from query: ',
  //   Object.entries(eaters.toObject()[0])
  //     .filter(([key]) => days.includes(key))
  //     .reduce((sum, el: [string, number]) => sum + el[1], 0),
  // )

  await db.create('lunch', {
    week: '28',
    Mon: ['youzi', 'Marco', 'Luigui'],
    lala: 10,
  })
  // deepEqual(
  //   await db.query('lunch').cardinality('Mon').get(),
  //   {
  //     Mon: 7,
  //   },
  //   'main cardinality no group by',
  // )

  // deepEqual(
  //   await db.query('lunch').cardinality('Mon').groupBy('week').get(),
  //   {
  //     27: {
  //       Mon: 5,
  //     },
  //     28: {
  //       Mon: 3,
  //     },
  //   },
  //   'cardinality main groupBy',
  // )
  // await db.query('lunch').sum('lala').groupBy('week').get().inspect()
  // await db.create('lunch', {
  //   week: 0,
  //   lala: 10,
  //   lele: 11,
  // })
  // await db.query('lunch').sum('lala', 'lele').get().inspect()
})
