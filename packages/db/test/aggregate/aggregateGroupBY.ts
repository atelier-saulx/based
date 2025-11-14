import { equal } from 'node:assert'
import { BasedDb } from '../../src/index.ts'
import { allCountryCodes } from '../shared/examples.ts'
import test from '../shared/test.ts'
import { throws, deepEqual } from '../shared/assert.ts'

await test('sum group by', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

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
          sequence: {
            ref: 'sequence',
            prop: 'votes',
          },
          flap: {
            props: {
              hello: 'uint32',
            },
          },
          country: { type: 'string' },
          AU: 'uint8',
          NL: 'uint8',
        },
      },
    },
  })
  const nl1 = db.create('vote', {
    country: 'bb',
    flap: { hello: 100 },
    NL: 10,
  })
  const nl2 = db.create('vote', {
    country: 'aa',
    NL: 20,
  })
  const au1 = db.create('vote', {
    country: 'aa',
    AU: 15,
  })
  const s = db.create('sequence', { votes: [nl1, nl2, au1] })

  deepEqual(
    await db.query('vote').sum('NL', 'AU').groupBy('country').get().toObject(),
    {
      bb: { NL: { sum: 10 }, AU: { sum: 0 } },
      aa: { NL: { sum: 20 }, AU: { sum: 15 } },
    },
    'sum, top level, groupBy',
  )

  deepEqual(
    await db.query('vote').groupBy('country').get().toObject(),
    { bb: {}, aa: {} },
    'groupBy with no aggregation function',
  )

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'bb')
      .groupBy('country')
      .sum('NL', 'AU')
      .get()
      .toObject(),
    { bb: { NL: { sum: 10 }, AU: { sum: 0 } } },
    'filter, groupBy on single distinct value',
  )
})

await test('count group by', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

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
          sequence: {
            ref: 'sequence',
            prop: 'votes',
          },
          flap: {
            props: {
              hello: 'uint32',
            },
          },
          country: { type: 'string' },
          AU: 'uint8',
          NL: 'uint8',
        },
      },
    },
  })
  const nl1 = db.create('vote', {
    country: 'bb',
    flap: { hello: 100 },
    NL: 10,
  })
  const nl2 = db.create('vote', {
    country: 'aa',
    NL: 20,
  })
  const au1 = db.create('vote', {
    country: 'aa',
    AU: 15,
  })
  const s = db.create('sequence', { votes: [nl1, nl2, au1] })

  deepEqual(
    await db.query('vote').count().groupBy('country').get().toObject(),
    {
      bb: {
        count: 1,
      },
      aa: {
        count: 2,
      },
    },
    'count, top level, groupBy',
  )

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'bb')
      .groupBy('country')
      .count()
      .get()
      .toObject(),
    { bb: { count: 1 } },
    'count, filter, groupBy on single distinct value',
  )
})

await test('variable key sum', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      user: {
        props: {
          flap: { type: 'uint32' },
          country: { type: 'string' },
          name: { type: 'string' },
          articles: {
            items: {
              ref: 'article',
              prop: 'contributors',
            },
          },
        },
      },
      article: {
        props: {
          name: { type: 'string' },
          contributors: {
            items: {
              ref: 'user',
              prop: 'articles',
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    country: 'NL',
    name: 'Mr snurp',
    flap: 10,
  })

  const flippie = db.create('user', {
    country: 'NL',
    name: 'Flippie',
    flap: 20,
  })

  const derpie = db.create('user', {
    country: 'BR',
    name: 'Derpie',
    flap: 30,
  })

  const dinkelDoink = db.create('user', {
    name: 'Dinkel Doink',
    flap: 40,
  })

  const cipolla = db.create('user', {
    country: 'IT',
    name: 'Carlo Cipolla',
    flap: 80,
  })

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp, flippie, derpie, dinkelDoink],
  })

  const stupidity = db.create('article', {
    name: 'Les lois fondamentales de la stupidité humaine',
    contributors: [cipolla],
  })

  deepEqual(
    await db
      .query('article')
      .include((q) => q('contributors').sum('flap'), 'name')
      .get()
      .toObject(),
    [
      {
        id: 1,
        name: 'The wonders of Strudel',
        contributors: { flap: { sum: 100 } },
      },
      {
        id: 2,
        name: 'Les lois fondamentales de la stupidité humaine',
        contributors: { flap: { sum: 80 } },
      },
    ],
    'sum, branched query, var len string',
  )

  deepEqual(
    await db.query('user').groupBy('name').sum('flap').get().toObject(),
    {
      Flippie: { flap: { sum: 20 } },
      'Carlo Cipolla': { flap: { sum: 80 } },
      'Mr snurp': { flap: { sum: 10 } },
      'Dinkel Doink': { flap: { sum: 40 } },
      Derpie: { flap: { sum: 30 } },
    },
    'sum, groupBy, main',
  )

  deepEqual(
    await db.query('user').groupBy('country').sum('flap').get().toObject(),
    {
      $undefined: { flap: { sum: 40 } },
      NL: { flap: { sum: 30 } },
      BR: { flap: { sum: 30 } },
      IT: { flap: { sum: 80 } },
    },
    'sum, groupBy, main, $undefined',
  )

  deepEqual(
    await db
      .query('article')
      .include((select) => {
        select('contributors').groupBy('name').sum('flap')
      })
      .get()
      .toObject(),
    [
      {
        id: 1,
        contributors: {
          Flippie: { flap: { sum: 20 } },
          'Mr snurp': { flap: { sum: 10 } },
          Derpie: { flap: { sum: 30 } },
          'Dinkel Doink': { flap: { sum: 40 } },
        },
      },
      {
        id: 2,
        contributors: {
          'Carlo Cipolla': { flap: { sum: 80 } },
        },
      },
    ],
    'sum, branched query, groupBy, references',
  )
})

await test('group by unique numbers', async (t) => {
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
        vendorIduint8: 'uint8',
        vendorIdint8: 'int8',
        vendorIduint16: 'uint16',
        vendorIdint16: 'int16',
        vendorIduint32: 'int32',
        vendorIdint32: 'int32',
        vendorIdnumber: 'number',
      },
    },
  })

  db.create('trip', {
    vendorIduint8: 13,
    vendorIdint8: 13,
    vendorIduint16: 813,
    vendorIdint16: 813,
    vendorIduint32: 813,
    vendorIdint32: 813,
    vendorIdnumber: 813.813,
    pickup: new Date('11/12/2024 11:00'),
    dropoff: new Date('11/12/2024 11:10'),
    distance: 513.44,
  })

  deepEqual(
    await db.query('trip').sum('distance').groupBy('vendorIduint8').get(),
    {
      13: {
        distance: { sum: 513.44 },
      },
    },
    'group by number',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('vendorIdint8').get(),
    {
      13: {
        distance: { sum: 513.44 },
      },
    },
    'group by number',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('vendorIduint16').get(),
    {
      813: {
        distance: { sum: 513.44 },
      },
    },
    'group by number',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('vendorIdint16').get(),
    {
      813: {
        distance: { sum: 513.44 },
      },
    },
    'group by number',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('vendorIduint32').get(),
    {
      813: {
        distance: { sum: 513.44 },
      },
    },
    'group by number',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('vendorIdint32').get(),
    {
      813: {
        distance: { sum: 513.44 },
      },
    },
    'group by number',
  )
  deepEqual(
    await db.query('trip').sum('distance').groupBy('vendorIdnumber').get(),
    {
      813.813: {
        distance: { sum: 513.44 },
      },
    },
    'group by number',
  )
})

await test('groupBy ranges in numeric properties', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      trip: {
        tripId: 'number',
        pickup: 'timestamp',
        dropoff: 'timestamp',
        distance: 'number',
      },
    },
  })

  for (let i = 0; i < 10; i++) {
    db.create('trip', {
      tripId: i,
      pickup: new Date('08/28/2024').getTime() * 1e4,
      distance: Math.random() * 1e4 * Math.random(),
    })
  }

  // await db.query('trip').sum('distance').groupBy('tripId').get().inspect()
})
