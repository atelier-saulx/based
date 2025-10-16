import { BasedDb, groupBy } from '../../src/index.js'
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

await test('multiple functions', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      sequence: {
        props: {
          votes: {
            items: {
              ref: 'vote',
              prop: 'sequence',
            },
          },
        },
      },
      vote: {
        props: {
          judges: 'cardinality',
          sequence: {
            ref: 'sequence',
            prop: 'votes',
          },
          region: { type: 'string' },
          AU: 'uint8',
          AT: 'int8',
          NL: 'uint16',
          NO: 'int16',
          PT: 'uint32',
          PL: 'int32',
          FI: 'number',
        },
      },
    },
  })
  const nl1 = db.create('vote', {
    region: 'bb',
    NL: 10,
    NO: -10,
    PT: 10,
    PL: -10,
    FI: -1_000_000.3,
  })
  const nl2 = db.create('vote', {
    region: 'bb',
    NL: 23,
    NO: -23,
    PT: 33,
    PL: -33,
  })
  const au1 = db.create('vote', {
    region: 'aa',
    NL: 43,
    NO: -43,
    PT: 43,
    PL: -43,
  })
  const au2 = db.create('vote', {
    region: 'aa',
    NL: 50,
    NO: -50,
    PT: 50,
    PL: -20,
  })
  const br1 = db.create('vote', {
    region: 'Great',
    NL: 50,
    NO: -50,
    PT: 50,
    PL: -50,
    FI: -50.999,
  })
  const s = db.create('sequence', { votes: [nl1, nl2, au1, au2, br1] })

  // deepEqual(
  //   await db.query('vote').sum('NL').sum('NO').max('NL').min('NL').get(),
  //   { NL: { sum: 176, max: 50, min: 10 }, NO: { sum: -176 } },
  //   'multiple func no groupBy',
  // )

  // deepEqual(
  //   await db
  //     .query('vote')
  //     .sum('NL')
  //     .sum('NO')
  //     .max('NL')
  //     .min('NL')
  //     .groupBy('region')
  //     .get(),
  //   {
  //     bb: { NL: { sum: 33, max: 23, min: 10 }, NO: { sum: -33 } },
  //     aa: { NL: { sum: 93, max: 50, min: 43 }, NO: { sum: -93 } },
  //     Great: { NL: { sum: 50, max: 50, min: 50 }, NO: { sum: -50 } },
  //   },
  //   'multiple func with groupBy',
  // )

  // const multi = await db
  //   .query('vote')
  //   // .count() // This is still buggy
  //   .sum('NL')
  //   .stddev('NO')
  //   .max('PT')
  //   .sum('PL')
  //   .stddev('PT', 'NO')
  //   .sum('NO')
  //   .max('NL')
  //   .avg('NO')
  //   .min('NL')
  //   .sum('NO')
  //   .get()

  db.create('vote', { judges: ['lala', 'lele', 'lili'] })

  const multi = await db
    .query('vote')
    .sum('NL')
    // .max('PT')
    .cardinality('judges')
    // .sum('NL')
    // .max('PT')
    // .avg('NO')
    // .min('NL')
    // .sum('NO')
    // .groupBy('region')
    .get()

  console.log(multi.toObject().judges)
  // console.log(multi.toObject())
  console.log('------------------')
  multi.inspect(10)
})
