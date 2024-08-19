import test from 'ava'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.serial('range', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
    maxModifySize: 1e4,
  })

  db.updateSchema({
    types: {
      user: {
        fields: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'integer' },
          nr: { type: 'integer' },
          location: {
            type: 'object',
            properties: {
              address: { type: 'string' },
            },
          },
        },
      },
    },
  })

  db.create('user', {
    age: 12,
    nr: 1,
    email: 'merp_1@once.net',
    location: {
      address: 'Derpstreet 1',
    },
  })

  db.create('user', {
    age: 99,
    nr: 2,
    email: 'merp_2@once.net',
    location: {
      address: 'Derpstreet 2',
    },
  })

  db.create('user', {
    age: 37,
    nr: 3,
    email: 'merp_3@once.net',
    location: {
      address: 'Derpstreet 3',
    },
  })

  db.drain()

  const result = db.query('user').include('nr').range(1, 1).get()

  t.deepEqual(result.toObject(), [{ id: 2, nr: 2 }])

  const result2 = db.query('user').include('nr').sort('email').range(1, 1).get()

  t.deepEqual(result2.toObject(), [{ id: 2, nr: 2 }])
})
