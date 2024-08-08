import test from 'ava'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.serial('single reference query', async (t) => {
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
        },
      },
      blup: {
        fields: {
          age: { type: 'integer' },
          name: { type: 'string' },
          // @ts-ignore
          flap: { type: 'string', maxBytes: 1 },
        },
      },
      simple: {
        fields: {
          smurp: { type: 'integer' },
          user: { type: 'reference', allowedType: 'user' },
          lilBlup: { type: 'reference', allowedType: 'blup' },
          flap: {
            type: 'object',
            properties: {
              power: { type: 'integer' },
            },
          },
        },
      },
    },
  })

  const blup = db.create('blup', {
    flap: 'B',
    age: 10,
    name: 'mr blup',
  })

  const differentBlup = db.create('blup', {
    flap: 'C',
    age: 20,
    name: 'mr blup 2',
  })

  const user = db.create('user', {
    myBlup: blup,
  })

  const user2 = db.create('user', {
    myBlup: differentBlup,
  })

  db.create('simple', {
    flap: {
      power: 10,
    },
    user,
  })

  db.create('simple', {
    lilBlup: blup,
    user: user2,
  })

  db.create('simple', {
    lilBlup: blup,
    flap: {
      power: 10,
    },
  })

  db.create('simple', {
    lilBlup: differentBlup,
    flap: {
      power: 10,
    },
  })

  db.drain()

  const result2 = db.query('simple').filter('user.myBlup.age', '=', 10).get()

  t.deepEqual(result2.data.toObject(), [
    {
      id: 1,
      smurp: 0,
      flap: {
        power: 10,
      },
    },
  ])

  const result = db
    .query('simple')
    .filter('lilBlup.age', '=', 20)
    .filter('flap.power', '=', 10)
    .include('lilBlup', 'flap')
    .get()

  t.deepEqual(result.data.toObject(), [
    {
      id: 4,
      lilBlup: {
        id: 2,
        age: 20,
        name: 'mr blup 2',
        flap: 'C',
      },
      flap: {
        power: 10,
      },
    },
  ])
})
