import test from 'ava'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.serial('string', async (t) => {
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
          myBlup: { type: 'reference', allowedType: 'blup' },
          name: { type: 'string' },
          flap: { type: 'integer' },
          email: { type: 'string', maxLength: 15 }, // maxLength: 10
          age: { type: 'integer' },
          snurp: { type: 'string' },
          burp: { type: 'integer' },
          location: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              x: { type: 'integer' },
              y: { type: 'integer' },
            },
          },
        },
      },
    },
  })

  const user = db.create('user', {
    age: 99,
    burp: 66,
    snurp: 'derp derp',
    email: 'merp_merp@once.net',
    location: {
      label: 'BLA BLA',
    },
  })

  db.drain()

  const result = db.query('user').get()
  t.deepEqual(result.data.toObject(), [
    {
      id: 1,
      name: '',
      flap: 0,
      email: 'merp_merp@once.net',
      age: 99,
      snurp: 'derp derp',
      burp: 66,
      location: { label: 'BLA BLA', x: 0, y: 0 },
    },
  ])
})
