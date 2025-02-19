import { BasedDb, xxHash64 } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, notStrictEqual } from 'node:assert'
import { setTimeout as setTimeoutAsync } from 'timers/promises'

await test('sortCardinality', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      article: {
        derp: 'number',
        count: 'cardinality',
        brazilians: 'cardinality',
      },
    },
  })

  let test = await db.create('article', {
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

  let myArticle = await db.create('article', {
    count: 'myCoolValue',
    derp: 100,
    // Cardinality is being updated without being set/create
  })

  deepEqual(
    (
      await db
        .query('article')
        .sort('count', 'desc')
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

  await db.update('article', myArticle, {
    count: 'lala',
  })

  await db.drain()

  await db
    .query('article')
    .sort('count', 'asc')
    .include('count', 'brazilians')
    .get()

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

  console.time('1M Distinct Brazos update')
  await db.update('article', myArticle, {
    brazilians: brazos,
  })
  console.timeEnd('1M Distinct Brazos update')

  await db.drain()

  notStrictEqual(
    (
      await db
        .query('article')
        .sort('brazilians', 'desc')
        .include('count', 'brazilians')
        .get()
    ).toObject(),
    [
      {
        id: 2,
        count: 2,
        brazilians: 992078,
      },
      {
        id: 1,
        count: 7,
        brazilians: 1,
      },
    ],
    'update 1M distinct values, include, sort desc',
  )

  db.delete('article', test)

  await db.drain()

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
    ],
    'delete a register',
  )
})
