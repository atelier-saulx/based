import { equal } from 'node:assert'
import { BasedDb } from '../../src/index.js'
import { allCountryCodes } from '../shared/examples.js'
import test from '../shared/test.js'
import { throws, deepEqual } from '../shared/assert.js'
import { fastPrng } from '@based/utils'

await test('undefined numbers', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      vote: {
        props: {
          region: { type: 'string' },
          AU: 'uint8',
          FI: 'number',
        },
      },
    },
  })
  const eu1 = db.create('vote', {
    region: 'EU',
    AU: 10,
    FI: -1_000_000.3,
  })
  const eu2 = db.create('vote', {
    region: 'EU',
    AU: 23,
  })

  deepEqual(
    await db.query('vote').max('AU', 'FI').groupBy('region').get().toObject(),
    {
      EU: {
        AU: 23,
        FI: 0,
      },
    },
    'number is initialized with zero',
  )
  deepEqual(
    await db.query('vote').avg('AU', 'FI').groupBy('region').get().toObject(),
    {
      EU: {
        AU: 16.5,
        FI: -500_000.15,
      },
    },
    'avg affected by count because number is initialized with zero',
  )

  deepEqual(
    await db
      .query('vote')
      .harmonicMean('AU', 'FI')
      .groupBy('region')
      .get()
      .toObject(),
    {
      EU: {
        AU: 13.93939393939394,
        FI: 0,
      },
    },
    'harmonic_mean affected by count because number is initialized with zero',
  )
})

await test('boundary cases for validation', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      movie: {
        name: 'string',
        year: 'number',
        genre: ['Comedy', 'Thriller', 'Drama', 'Crime'],
        actors: {
          items: {
            ref: 'actor',
            prop: 'actors',
            $rating: 'uint16',
          },
        },
      },
      actor: {
        name: 'string',
        movies: {
          items: {
            ref: 'movie',
            prop: 'movies',
          },
        },
      },
    },
  })

  const a1 = db.create('actor', {
    name: 'Uma Thurman',
  })
  const a2 = db.create('actor', {
    name: 'Jonh Travolta',
  })

  const m1 = await db.create('movie', {
    name: 'Kill Bill',
    year: 2003,
    actors: [
      {
        id: a1,
        $rating: 55,
      },
    ],
  })
  const m2 = await db.create('movie', {
    name: 'Pulp Fiction',
    year: 1994,
    actors: [
      {
        id: a1,
        $rating: 63,
      },
      {
        id: a2,
        $rating: 77,
      },
    ],
  })

  deepEqual(
    await db.query('movie').groupBy('year').count().get(),
    {
      1994: {
        count: 1,
      },
      2003: {
        count: 1,
      },
    },
    'group by numeric valus is allowed',
  )

  deepEqual(
    await db.query('movie').groupBy('genre').min('year').get(),
    {
      undefined: {
        year: 1994,
      },
    },
    'groupBy undefined prop',
  )
})
