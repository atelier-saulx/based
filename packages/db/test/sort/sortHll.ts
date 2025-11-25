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
        count: {
          type: 'cardinality',
          precision: 14,
        },
        brazilians: {
          type: 'cardinality',
          precision: 14,
        },
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

  const numTrials = 1e3
  let successTrials = 0

  for (let trial = 0; trial < numTrials; trial++) {
    let brazos: any[] = []
    let num_brazos = 1e4
    for (let i = 0; i < num_brazos; i++) {
      brazos.push(names[Math.floor(Math.random() * names.length)] + i)
    }

    const testRecordId = await db.create('article', {
      brazilians: brazos,
    })

    const result = await db
      .query('article')
      .filter('id', '=', testRecordId)
      .get()
      .toObject()

    const count = Math.abs(result[0].brazilians)
    const countError = count - num_brazos

    if (countError < num_brazos * 0.02) {
      successTrials++
    }

    await db.delete('article', testRecordId)
    await db.drain()
  }

  console.log(`Success rate:  ${(successTrials / numTrials) * 100}%`)

  const confidenceLevel = 0.95
  const successRate = successTrials / numTrials

  equal(
    successRate >= confidenceLevel,
    true,
    'HLL meets 2% accuracy with 95% confidence.',
  )

  deepEqual(
    (
      await db.query('article').sort('count', 'desc').include('count').get()
    ).toObject(),
    [
      {
        id: 1,
        count: 7,
      },
      {
        id: 2,
        count: 2,
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

  deepEqual(
    await db
      .query('article')
      .sort('count', 'desc')
      .include('count')
      .get()
      .toObject(),
    [
      { id: 1008, count: 3 },
      { id: 2, count: 2 },
      { id: 1009, count: 2 },
      { id: 1003, count: 1 },
      { id: 1004, count: 1 },
      { id: 1005, count: 1 },
      { id: 1006, count: 0 },
      { id: 1007, count: 0 },
    ],
    'test from undefined / non undefined',
  )
})
