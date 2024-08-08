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
    email: 'snurp@snurp.snurp',
  })

  const flap = db.create('user', {
    name: 'mr flap',
    age: 50,
    email: 'flap@flap.flap',
  })

  const blap = db.create('user', {
    name: 'mr blap',
    age: 200,
    email: 'blap@blap.blap',
  })

  const nurp = db.create('user', {
    name: 'mr nurp',
    age: 200,
    email: 'nurp@nurp.nurp',
  })

  db.drain()

  console.log(
    db.query('user').sort('age', 'desc').include('email', 'age').get(),
  )

  db.stats()

  t.true(true)
})
