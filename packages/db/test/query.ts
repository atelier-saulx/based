import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await test('query', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  const db = new BasedDb({
    path: dbFolder,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start()

  db.updateSchema({
    types: {
      user: {
        fields: {
          age: { type: 'integer' },
          name: { type: 'string' },
          // @ts-ignore
          countryCode: { type: 'string', maxBytes: 2 },
          location: {
            type: 'object',
            properties: {
              long: { type: 'number' },
              lat: { type: 'number' },
            },
          },
        },
      },
    },
  })

  db.create('user', {
    age: 50,
    name: 'mr X',
    countryCode: 'us',
    location: {
      long: 50.123,
      lat: 51.213123,
    },
  })

  db.drain()

  deepEqual(
    db.query('user').include('id').get().toObject(),
    [{ id: 1 }],
    'Id only',
  )

  deepEqual(
    db
      .query('user')
      .filter('age', '<', 20)
      .include('id', 'age')
      .get()
      .toObject(),
    [],
  )
})
