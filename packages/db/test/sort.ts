import test from 'ava'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.serial('sort', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
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

  db.create('user', {
    name: 'mr z',
    age: 1,
    email: 'z@z.z',
  })

  db.drain()

  t.deepEqual(
    db
      .query('user')
      .sort('age', 'desc')
      .include('email', 'age')
      .get()
      .data.toObject(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
  )

  t.deepEqual(
    db
      .query('user')
      .sort('age', 'asc')
      .include('email', 'age')
      .get()
      .data.toObject(),
    [
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
    ],
  )

  t.deepEqual(
    db
      .query('user')
      .sort('email', 'asc')
      .include('email', 'age')
      .get()
      .data.toObject(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
  )

  t.deepEqual(
    db
      .query('user')
      .sort('email', 'desc')
      .include('email', 'age')
      .get()
      .data.toObject(),
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

  t.deepEqual(
    db
      .query('user')
      .sort('email')
      .include('email', 'age')
      .get()
      .data.toObject(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 6, email: 'x@x.x', age: 999 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
  )

  t.deepEqual(
    db.query('user').sort('age').include('email', 'age').get().data.toObject(),
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

  t.deepEqual(
    db
      .query('user')
      .sort('email')
      .include('email', 'age')
      .get()
      .data.toObject(),
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

  t.deepEqual(
    db.query('user').sort('age').include('email', 'age').get().data.toObject(),
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

  t.deepEqual(
    db.query('user').sort('age').include('email', 'age').get().data.toObject(),
    [
      { id: 6, email: 'dd@dd.dd', age: 0 },
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
    ],
  )
})
