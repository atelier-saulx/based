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
          name: { type: 'string' },
          age: { type: 'integer' },
          email: { type: 'string' },
        },
      },
    },
  })

  const snurp = db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp.snurp',
  })

  const flap = db.create('user', {
    name: 'mr flap',
    age: 50,
    email: 'flap@flap.flap.flap',
  })

  const blap = db.create('user', {
    name: 'mr blap',
    age: 200,
    email: 'blap@blap.blap.blap',
  })

  const nurp = db.create('user', {
    name: 'mr nurp',
    age: 200,
    email: 'nurp@nurp.nurp.nurp',
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
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'blap@blap.blap.blap', age: 200 },
      { id: 1, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
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
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 1, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 3, email: 'blap@blap.blap.blap', age: 200 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
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
      { id: 3, email: 'blap@blap.blap.blap', age: 200 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'snurp@snurp.snurp.snurp', age: 99 },
    ],
  )
})
