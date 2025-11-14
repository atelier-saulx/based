import { BasedDb, groupBy } from '../../src/index.ts'
import test from '../shared/test.ts'
import { deepEqual } from '../shared/assert.ts'

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

  const j = db.create('vote', {
    region: 'Great',
    judges: ['lala', 'lele', 'lili'],
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
        average: -29.333333333333332,
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
          average: -16.5,
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
          average: -46.5,
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
          average: -25,
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
      NO: {
        stddev: 21.518983866964227,
      },
      count: 6,
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
        NO: {
          stddev: 35.35533905932738,
        },
        count: 2,
      },
    },
    'multiple main + count groupBy',
  )

  const multiref = await db
    .query('sequence')
    .include((q) => q('votes').sum('NL').count().cardinality('judges'))
    .get()

  deepEqual(
    multiref,
    [
      {
        id: 1,
        votes: {
          NL: {
            sum: 176,
          },
          count: 5,
          judges: {
            cardinality: 0,
          },
        },
      },
    ],
    'multi references + count + no cardinality',
  )

  db.create('sequence', { votes: [j] })

  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').sum('NL').count().cardinality('judges'))
      .get(),
    [
      {
        id: 1,
        votes: { NL: { sum: 176 }, count: 5, judges: { cardinality: 0 } },
      },
      {
        id: 2,
        votes: { NL: { sum: 0 }, count: 1, judges: { cardinality: 3 } },
      },
    ],
    'multi references + count + cardinality',
  )

  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').count().sum('NL').cardinality('judges'))
      .get(),
    [
      {
        id: 1,
        votes: { count: 5, NL: { sum: 176 }, judges: { cardinality: 0 } },
      },
      {
        id: 2,
        votes: { count: 1, NL: { sum: 0 }, judges: { cardinality: 3 } },
      },
    ],
    'multi references + count first + cardinality',
  )
})
