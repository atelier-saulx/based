import { BasedDb, groupBy } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

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
  // const s = db.create('sequence', { votes: [nl1, nl2, au1, au2, br1] })
  db.drain()
  db.create('sequence', { votes: nl1 })
  db.create('sequence', { votes: nl2 })
  db.create('sequence', { votes: au1 })
  db.create('sequence', { votes: au2 })
  db.create('sequence', { votes: br1 })

  deepEqual(
    await db.query('vote').sum('NL').sum('NO').max('NL').min('NL').get(),
    { NL: { sum: 176, max: 50, min: 10 }, NO: { sum: -176 } },
    'multiple func main no groupBy',
  )

  deepEqual(
    await db
      .query('vote')
      .sum('NL')
      .sum('NO')
      .max('NL')
      .min('NL')
      .groupBy('region')
      .get(),
    {
      bb: { NL: { sum: 33, max: 23, min: 10 }, NO: { sum: -33 } },
      aa: { NL: { sum: 93, max: 50, min: 43 }, NO: { sum: -93 } },
      Great: { NL: { sum: 50, max: 50, min: 50 }, NO: { sum: -50 } },
    },
    'multiple func main with groupBy',
  )

  // const j = db.create('vote', {
  //   region: 'Great',
  //   judges: ['lala', 'lele', 'lili'],
  // })

  db.drain()
  db.create('vote', {
    region: 'Great',
    judges: 'lala',
  })
  db.create('vote', {
    region: 'Great',
    judges: 'lele',
  })
  db.create('vote', {
    region: 'Great',
    judges: 'lili',
  })

  const multi = await db
    .query('vote')
    .sum('NL')
    .max('PT')
    .cardinality('judges')
    .sum('NL')
    .max('PT')
    .avg('NO')
    .min('NL')
    .sum('NO')
    .get()

  deepEqual(
    multi,
    {
      NL: {
        sum: 176,
        min: 0,
      },
      PT: {
        max: 50,
      },
      NO: {
        // avg: -29.333333333333332, // originally one node because of multiref
        avg: -22, // 3 nodes temporarely
        sum: -176,
      },
      judges: {
        cardinality: 3,
      },
    },
    'multiple main + no main (cardinality), no groupBY',
  )

  const multi2 = await db
    .query('vote')
    .sum('NL')
    .max('PT')
    .cardinality('judges')
    .sum('NL')
    .max('PT')
    .avg('NO')
    .min('NL')
    .sum('NO')
    .groupBy('region')
    .get()

  deepEqual(
    multi2,
    {
      bb: {
        NL: {
          sum: 33,
          min: 10,
        },
        PT: {
          max: 33,
        },
        NO: {
          avg: -16.5,
          sum: -33,
        },
        judges: {
          cardinality: 0,
        },
      },
      aa: {
        NL: {
          sum: 93,
          min: 43,
        },
        PT: {
          max: 50,
        },
        NO: {
          avg: -46.5,
          sum: -93,
        },
        judges: {
          cardinality: 0,
        },
      },
      Great: {
        NL: {
          sum: 50,
          min: 0,
        },
        PT: {
          max: 50,
        },
        NO: {
          // avg: -25, // also one node only originally
          avg: -12.5,
          sum: -50,
        },
        judges: {
          cardinality: 3,
        },
      },
    },
    'multiple main + no main (cardinality), groupBY',
  )

  deepEqual(
    await db.query('vote').sum('NL').count().sum('PT').stddev('NO').get(),
    {
      NL: {
        sum: 176,
      },
      PT: {
        sum: 186,
      },
      // NO: {
      //   stddev: 21.518983866964227, // also one node only originally
      // },
      // count: 6, // also one node only originally
      NO: { stddev: 22.696758736499294 }, // std([-10,-23,-43,-50,-50,0,0,0]) ans = 22.697
      count: 8,
    },
    'multiple main + count no groupBy',
  )
  deepEqual(
    await db
      .query('vote')
      .sum('NL')
      .count()
      .sum('PT')
      .stddev('NO')
      .groupBy('region')
      .get(),
    {
      bb: {
        NL: {
          sum: 33,
        },
        PT: {
          sum: 43,
        },
        NO: {
          stddev: 9.192388155425117,
        },
        count: 2,
      },
      aa: {
        NL: {
          sum: 93,
        },
        PT: {
          sum: 93,
        },
        NO: {
          stddev: 4.949747468305833,
        },
        count: 2,
      },
      Great: {
        NL: {
          sum: 50,
        },
        PT: {
          sum: 50,
        },
        // NO: {
        //   stddev: 35.35533905932738,
        // },
        // count: 2,
        NO: { stddev: 25 },
        count: 4,
      },
    },
    'multiple main + count groupBy',
  )

  // const multiref = await db
  //   .query('sequence')
  //   .include((q) => q('votes').sum('NL').count().cardinality('judges'))
  //   .get()

  // deepEqual(
  //   multiref,
  //   [
  //     {
  //       id: 1,
  //       votes: {
  //         NL: {
  //           sum: 176,
  //         },
  //         count: 5,
  //         judges: {
  //           cardinality: 0,
  //         },
  //       },
  //     },
  //   ],
  //   'multi references + count + no cardinality',
  // )

  // db.create('sequence', { votes: [j] })

  // deepEqual(
  //   await db
  //     .query('sequence')
  //     .include((q) => q('votes').sum('NL').count().cardinality('judges'))
  //     .get(),
  //   [
  //     {
  //       id: 1,
  //       votes: { NL: { sum: 176 }, count: 5, judges: { cardinality: 0 } },
  //     },
  //     {
  //       id: 2,
  //       votes: { NL: { sum: 0 }, count: 1, judges: { cardinality: 3 } },
  //     },
  //   ],
  //   'multi references + count + cardinality',
  // )

  // deepEqual(
  //   await db
  //     .query('sequence')
  //     .include((q) => q('votes').count().sum('NL').cardinality('judges'))
  //     .get(),
  //   [
  //     {
  //       id: 1,
  //       votes: { count: 5, NL: { sum: 176 }, judges: { cardinality: 0 } },
  //     },
  //     {
  //       id: 2,
  //       votes: { count: 1, NL: { sum: 0 }, judges: { cardinality: 3 } },
  //     },
  //   ],
  //   'multi references + count first + cardinality',
  // )
})
