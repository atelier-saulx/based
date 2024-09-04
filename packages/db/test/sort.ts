import { fileURLToPath } from 'url'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import test from './shared/test.js'
import { deepEqual, equal } from 'node:assert'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await test('sort', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  const db = new BasedDb({
    path: dbFolder,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        fields: {
          gender: { type: 'integer' },
          age: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  })

  db.create('user', {
    name: 'mr blap',
    age: 201,
    email: 'blap@blap.blap.blap',
  })

  db.create('user', {
    name: 'mr flap',
    age: 50,
    email: 'flap@flap.flap.flap',
  })

  db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp.snurp',
  })

  db.drain()

  db.create('user', {
    name: 'mr nurp',
    age: 200,
    email: 'nurp@nurp.nurp.nurp',
  })

  db.drain()

  const mrZ = db.create('user', {
    name: 'mr z',
    age: 1,
    email: 'z@z.z',
  })

  db.drain()

  deepEqual(
    db
      .query('user')
      .sort('age', 'desc')
      .include('email', 'age')
      .get()
      .toObject(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
  )

  deepEqual(
    db
      .query('user')
      .sort('age', 'asc')
      .include('email', 'age')
      .get()
      .toObject(),
    [
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
    ],
  )

  deepEqual(
    db
      .query('user')
      .sort('email', 'asc')
      .include('email', 'age')
      .get()
      .toObject(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
  )

  deepEqual(
    db
      .query('user')
      .sort('email', 'desc')
      .include('email', 'age')
      .get()
      .toObject(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 5, email: 'z@z.z', age: 1 },
    ].reverse(),
  )

  const mrX = db.create('user', {
    name: 'mr x',
    age: 999,
    email: 'x@x.x',
  })

  db.drain()

  deepEqual(
    db.query('user').sort('email').include('email', 'age').get().toObject(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 6, email: 'x@x.x', age: 999 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
  )

  deepEqual(
    db.query('user').sort('age').include('email', 'age').get().toObject(),
    [
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 6, email: 'x@x.x', age: 999 },
    ],
  )

  db.update('user', mrX, {
    email: 'dd@dd.dd',
  })

  db.drain()

  deepEqual(
    db.query('user').sort('email').include('email', 'age').get().toObject(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 6, email: 'dd@dd.dd', age: 999 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
  )

  db.update(
    'user',
    mrX,
    {
      age: 1e6,
    },
    true,
  )

  db.drain()

  deepEqual(
    db.query('user').sort('age').include('email', 'age').get().toObject(),
    [
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 6, email: 'dd@dd.dd', age: 1e6 },
    ],
  )

  db.update('user', mrX, {
    age: 0,
  })

  db.drain()

  deepEqual(
    db.query('user').sort('age').include('email', 'age').get().toObject(),
    [
      { id: 6, email: 'dd@dd.dd', age: 0 },
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
    ],
  )

  deepEqual(
    db.query('user').sort('age').include('email', 'age').get().toObject(),
    [
      { id: 6, email: 'dd@dd.dd', age: 0 },
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
    ],
  )

  // ------------------------------
  const ids = []
  for (let i = 0; i < 10; i++) {
    ids.push(i)
    db.create('user', {
      name: 'mr ' + i,
      age: i + 300,
      email: i + '@z.z',
    })
  }
  db.drain()

  deepEqual(
    db.query('user', ids).include('name', 'age').sort('age').get().toObject(),
    [
      { id: 6, name: 'mr x', age: 0 },
      { id: 5, name: 'mr z', age: 1 },
      { id: 2, name: 'mr flap', age: 50 },
      { id: 3, name: 'mr snurp', age: 99 },
      { id: 4, name: 'mr nurp', age: 200 },
      { id: 1, name: 'mr blap', age: 201 },
      { id: 7, name: 'mr 0', age: 300 },
      { id: 8, name: 'mr 1', age: 301 },
      { id: 9, name: 'mr 2', age: 302 },
    ],
  )

  deepEqual(
    db
      .query('user', ids)
      .include('name', 'age')
      .sort('age', 'desc')
      .get()
      .toObject(),
    [
      { id: 9, name: 'mr 2', age: 302 },
      { id: 8, name: 'mr 1', age: 301 },
      { id: 7, name: 'mr 0', age: 300 },
      { id: 1, name: 'mr blap', age: 201 },
      { id: 4, name: 'mr nurp', age: 200 },
      { id: 3, name: 'mr snurp', age: 99 },
      { id: 2, name: 'mr flap', age: 50 },
      { id: 5, name: 'mr z', age: 1 },
      { id: 6, name: 'mr x', age: 0 },
    ],
  )

  const ids2 = []
  for (let i = 1; i < 1000; i++) {
    ids2.push(i)
  }

  deepEqual(
    db
      .query('user', ids2)
      .include('name', 'age')
      .sort('age', 'asc')
      .get()
      .toObject(),
    [
      { id: 6, name: 'mr x', age: 0 },
      { id: 5, name: 'mr z', age: 1 },
      { id: 2, name: 'mr flap', age: 50 },
      { id: 3, name: 'mr snurp', age: 99 },
      { id: 4, name: 'mr nurp', age: 200 },
      { id: 1, name: 'mr blap', age: 201 },
      { id: 7, name: 'mr 0', age: 300 },
      { id: 8, name: 'mr 1', age: 301 },
      { id: 9, name: 'mr 2', age: 302 },
      { id: 10, name: 'mr 3', age: 303 },
      { id: 11, name: 'mr 4', age: 304 },
      { id: 12, name: 'mr 5', age: 305 },
      { id: 13, name: 'mr 6', age: 306 },
      { id: 14, name: 'mr 7', age: 307 },
      { id: 15, name: 'mr 8', age: 308 },
      { id: 16, name: 'mr 9', age: 309 },
    ],
  )

  db.remove('user', mrX)

  db.drain()

  deepEqual(
    db
      .query('user', ids2)
      .include('name', 'age')
      .sort('age', 'asc')
      .get()
      .toObject(),
    [
      { id: 5, name: 'mr z', age: 1 },
      { id: 2, name: 'mr flap', age: 50 },
      { id: 3, name: 'mr snurp', age: 99 },
      { id: 4, name: 'mr nurp', age: 200 },
      { id: 1, name: 'mr blap', age: 201 },
      { id: 7, name: 'mr 0', age: 300 },
      { id: 8, name: 'mr 1', age: 301 },
      { id: 9, name: 'mr 2', age: 302 },
      { id: 10, name: 'mr 3', age: 303 },
      { id: 11, name: 'mr 4', age: 304 },
      { id: 12, name: 'mr 5', age: 305 },
      { id: 13, name: 'mr 6', age: 306 },
      { id: 14, name: 'mr 7', age: 307 },
      { id: 15, name: 'mr 8', age: 308 },
      { id: 16, name: 'mr 9', age: 309 },
    ],
  )

  const mrBlurp = db.create('user', {
    age: 99,
  })

  db.drain()

  equal(db.query('user', ids2).include('name', 'age', 'email').get().length, 16)

  equal(
    db.query('user', ids2).include('name', 'age', 'email').sort('email').get()
      .length,
    16,
  )

  equal(
    db.query('user', ids2).include('name', 'age', 'email').sort('name').get()
      .length,
    16,
  )

  db.remove('user', mrBlurp)

  db.drain()

  equal(
    db.query('user', ids2).include('name', 'age', 'email').sort('name').get()
      .length,
    15,
  )

  db.update('user', mrZ, {
    email: '',
  })

  db.drain()

  equal(
    db.query('user', ids2).include('name', 'age', 'email').sort('email').get()
      .length,
    15,
  )
})

await test('sort - from start (1.5M items)', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  const db = new BasedDb({
    path: dbFolder,
  })

  await db.start()

  db.updateSchema({
    types: {
      user: {
        fields: {
          gender: { type: 'integer' },
          age: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  })

  db.create('user', {
    name: 'mr blap',
    age: 100,
    email: 'blap@blap.blap.blap',
  })

  db.create('user', {
    name: 'mr flap',
    age: 50,
    email: 'flap@flap.flap.flap',
  })

  for (let i = 0; i < 1500e3; i++) {
    db.create('user', {
      name: 'mr ' + i,
      age: i + 101,
    })
  }

  db.drain()

  deepEqual(
    db.query('user').include('name').sort('age').range(0, 2).get().toObject(),
    [
      { id: 2, name: 'mr flap' },
      { id: 1, name: 'mr blap' },
    ],
  )

  deepEqual(
    db.query('user').include('name').sort('age').range(0, 2).get().toObject(),
    [
      { id: 2, name: 'mr flap' },
      { id: 1, name: 'mr blap' },
    ],
  )

  deepEqual(
    db.query('user').include('name').sort('name').range(0, 2).get().toObject(),
    [
      {
        id: 3,
        name: 'mr 0',
      },
      {
        id: 4,
        name: 'mr 1',
      },
    ],
  )

  await db.stop()

  const newDb = new BasedDb({
    path: dbFolder,
  })

  await newDb.start()

  t.after(() => {
    return newDb.destroy()
  })

  deepEqual(
    newDb
      .query('user')
      .include('name')
      .sort('name')
      .range(0, 2)
      .get()
      .toObject(),
    [
      {
        id: 3,
        name: 'mr 0',
      },
      {
        id: 4,
        name: 'mr 1',
      },
    ],
  )
})
