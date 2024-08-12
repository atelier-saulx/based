import test from 'ava'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.serial('remove', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
  })

  db.updateSchema({
    types: {
      nurp: {
        fields: {
          email: { type: 'string' },
        },
      },
      user: {
        fields: {
          name: { type: 'string' },
          age: { type: 'integer' },
          email: { type: 'string' },
        },
      },
    },
  })

  const simple = db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp',
  })

  db.drain()

  db.remove('user', simple)

  db.drain()

  t.deepEqual(db.query('user').get().toObject(), [])

  const nurp = db.create('nurp', {})

  db.drain()

  t.deepEqual(db.query('nurp').include('email').get().toObject(), [
    {
      email: '',
      id: 1,
    },
  ])

  db.remove('nurp', nurp)

  db.drain()

  t.deepEqual(db.query('user').include('email').get().toObject(), [])
})
