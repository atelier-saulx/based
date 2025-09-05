import { BasedDb, xxHash64 } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual, equal } from 'node:assert'

const ENCODER = new TextEncoder()

await test('sortCardinality', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      article: {
        derp: 'number',
        count: 'cardinality',
        brazilians: 'cardinality',
      },
    },
  })

  let c1 = await db.create('article', {
    count: [
      'myCoolValue',
      'myCoolValue',
      'mr snurfels',
      'mr snurfels',
      'lala',
      'lala',
      'myCoolValue',
      'myCoolValue',
      'mr snurfels',
      'mr snurfels',
      'lala',
      'lala',
      'lele',
      'lili',
      'lolo',
      'lulu',
    ],
    derp: 1,
    brazilians: 'marco',
  })

  let c2 = await db.create('article', {
    count: 'myCoolValue',
    derp: 100,
  })

  deepEqual(
    (
      await db
        .query('article')
        .sort('brazilians', 'desc')
        .include('count', 'brazilians')
        .get()
    ).toObject(),
    [
      {
        id: 1,
        count: 7,
        brazilians: 1,
      },
      {
        id: 2,
        count: 1,
        brazilians: 0,
      },
    ],
    'create, with standalone values and array, include sort asc',
  )

  deepEqual(
    (
      await db.query('article').sort('count', 'asc').include('derp').get()
    ).toObject(),
    [
      {
        id: 2,
        derp: 100,
      },
      {
        id: 1,
        derp: 1,
      },
    ],
    'sort a not included cardinality field',
  )

  await db.update('article', c2, {
    count: 'lala',
  })

  await db.drain()

  deepEqual(
    (
      await db
        .query('article')
        .sort('count', 'asc')
        .include('count', 'brazilians')
        .get()
    ).toObject(),
    [
      {
        id: 2,
        count: 2,
        brazilians: 0,
      },
      {
        id: 1,
        count: 7,
        brazilians: 1,
      },
    ],
    'update, standalone, include, sort asc',
  )

  const names = [
    'João',
    'Maria',
    'José',
    'Ana',
    'Paulo',
    'Carlos',
    'Lucas',
    'Mariana',
    'Fernanda',
    'Gabriel',
  ]

  let brazos = []
  for (let i = 0; i < 1e6; i++) {
    brazos.push(names[Math.floor(Math.random() * names.length)] + i)
  }

  await db.update('article', c2, {
    brazilians: brazos,
  })

  await db.drain()

  const countError = Math.abs(
    (
      await db
        .query('article')
        .sort('brazilians', 'desc')
        .include('brazilians')
        .get()
        .toObject()
    )[0].brazilians - 1e6,
  )
  equal(countError < 1e6 * 0.2, true, 'HLL 2% typical accuracy.')

  deepEqual(
    (
      await db
        .query('article')
        .sort('brazilians', 'desc')
        .include('count')
        .get()
    ).toObject(),
    [
      {
        id: 2,
        count: 2,
      },
      {
        id: 1,
        count: 7,
      },
    ],
    'update 1M distinct values, exclude, sort desc',
  )

  db.delete('article', c1)

  await db.drain()

  deepEqual(
    (
      await db
        .query('article')
        .sort('brazilians', 'desc')
        .include('derp', 'count')
        .get()
    ).toObject(),
    [
      {
        id: 2,
        derp: 100,
        count: 2,
      },
    ],
    'delete a register',
  )

  const c3 = await db.create('article', {
    count: xxHash64(ENCODER.encode('name1')),
  })

  const c4 = await db.create('article', {
    count: 'name2',
  })

  const c5 = await db.create('article', {
    count: 'name3',
    derp: 2,
    brazilians: 'marco',
  })
  const c6 = await db.create('article', {})
  const c7 = await db.create('article', {})
  const c8 = await db.create('article', {
    count: ['name1', 'name2', 'name3'],
  })
  const c9 = await db.create('article', {
    count: ['name1', 'name2'],
  })

  console.log(
    await db
      .query('article')
      .sort('count', 'desc')
      .include('count')
      .get()
      .toObject(),
  )

  deepEqual(
    await db
      .query('article')
      .sort('count', 'desc')
      .include('count')
      .get()
      .toObject(),
    [
      { id: 8, count: 3 },
      { id: 2, count: 2 },
      { id: 9, count: 2 },
      { id: 3, count: 1 },
      { id: 4, count: 1 },
      { id: 5, count: 1 },
      { id: 6, count: 0 },
      { id: 7, count: 0 },
    ],
    'test from undefined / non undefined',
  )
})
