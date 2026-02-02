import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('modify boolean', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        isNice: 'boolean',
      },
    },
  })

  const a = db.create('user', {})
  const b = db.create('user', { isNice: true })
  const c = db.create('user', { isNice: false })

  deepEqual(await db.query('user').get(), [
    { id: 1, isNice: false },
    { id: 2, isNice: true },
    { id: 3, isNice: false },
  ])

  db.update('user', a, { isNice: true })
  db.update('user', b, { isNice: true })
  db.update('user', c, { isNice: true })

  deepEqual(await db.query('user').get(), [
    { id: 1, isNice: true },
    { id: 2, isNice: true },
    { id: 3, isNice: true },
  ])

  db.update('user', a, { isNice: false })
  db.update('user', b, { isNice: false })
  db.update('user', c, { isNice: false })

  deepEqual(await db.query('user').get(), [
    { id: 1, isNice: false },
    { id: 2, isNice: false },
    { id: 3, isNice: false },
  ])
})

await test('modify boolean on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        isNice: 'boolean',
      },
      holder: {
        toUser: {
          ref: 'user',
          prop: 'holders',
          $edgeBool: 'boolean',
        },
      },
    },
  })

  const u1 = await db.create('user', { isNice: true })
  console.log('???')
  const a = db.create('holder', {
    toUser: {
      id: u1,
    },
  })
  console.log('???------')
  const b = await db.create('holder', {
    toUser: {
      id: u1,
      $edgeBool: true,
    },
  })
  console.log('=================')
  const c = db.create('holder', {
    toUser: {
      id: u1,
      $edgeBool: false,
    },
  })

  // Basic creates
  // Check a (default false?)
  const resA = await db
    .query('holder', await a)
    .include('toUser.$edgeBool')
    .get()
    .toObject()

  console.dir(resA, { depth: null })

  deepEqual(resA.toUser?.$edgeBool, false)

  // Check b (true)
  const resB = await db
    .query('holder', await b)
    .include('toUser.$edgeBool')
    .get()
    .toObject()
  deepEqual(resB.toUser?.$edgeBool, true)

  // Check c (false)
  const resC = await db
    .query('holder', await c)
    .include('toUser.$edgeBool')
    .get()
    .toObject()
  deepEqual(resC.toUser?.$edgeBool, false)

  // Updates to true
  db.update('holder', await a, { toUser: { id: u1, $edgeBool: true } })
  db.update('holder', await b, { toUser: { id: u1, $edgeBool: true } })
  db.update('holder', await c, { toUser: { id: u1, $edgeBool: true } })

  const resA2 = await db
    .query('holder', await a)
    .include('toUser.$edgeBool')
    .get()
    .toObject()
  deepEqual(resA2.toUser?.$edgeBool, true)
  const resB2 = await db
    .query('holder', await b)
    .include('toUser.$edgeBool')
    .get()
    .toObject()
  deepEqual(resB2.toUser?.$edgeBool, true)
  const resC2 = await db
    .query('holder', await c)
    .include('toUser.$edgeBool')
    .get()
    .toObject()
  deepEqual(resC2.toUser?.$edgeBool, true)

  // Updates to false
  db.update('holder', await a, { toUser: { id: u1, $edgeBool: false } })
  db.update('holder', await b, { toUser: { id: u1, $edgeBool: false } })
  db.update('holder', await c, { toUser: { id: u1, $edgeBool: false } })

  const resA3 = await db
    .query('holder', await a)
    .include('toUser.$edgeBool')
    .get()
    .toObject()
  deepEqual(resA3.toUser?.$edgeBool, false)
  const resB3 = await db
    .query('holder', await b)
    .include('toUser.$edgeBool')
    .get()
    .toObject()
  deepEqual(resB3.toUser?.$edgeBool, false)
  const resC3 = await db
    .query('holder', await c)
    .include('toUser.$edgeBool')
    .get()
    .toObject()
  deepEqual(resC3.toUser?.$edgeBool, false)
})
