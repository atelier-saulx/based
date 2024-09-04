import { fileURLToPath } from 'url'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await test('string', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  const db = new BasedDb({
    path: dbFolder,
    maxModifySize: 1e4,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  try {
    console.log(db.query('user').get())
  } catch (e) {}

  db.updateSchema({
    types: {
      user: {
        fields: {
          myBlup: { type: 'reference', allowedType: 'blup' },
          name: { type: 'string' },
          flap: { type: 'integer' },
          email: { type: 'string', maxLength: 15 },
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

  // console.dir(db.schemaTypesParsed.user, { depth: 10 })

  db.create('user', {
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

  console.log(result.toObject())

  deepEqual(result.toObject(), [
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

test.skip('string + refs', async (t) => {
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
          myBlup: { type: 'reference', allowedType: 'blup' },
          name: { type: 'string' },
          flap: { type: 'integer' },
          age: { type: 'integer' },
          snurp: { type: 'string' },
          burp: { type: 'integer' },
          email: { type: 'string', maxLength: 15 }, // maxLength: 10
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
      blup: {
        fields: {
          flap: {
            type: 'string',
            // @ts-ignore
            maxBytes: 1,
          },
          name: { type: 'string' },
        },
      },
      simple: {
        // min max on string
        fields: {
          // @ts-ignore
          countryCode: { type: 'string', maxBytes: 2 },
          lilBlup: { type: 'reference', allowedType: 'blup' },
          vectorClock: { type: 'integer' },
          user: { type: 'reference', allowedType: 'user' },
        },
      },
    },
  })

  const users = []

  for (let i = 0; i < 1; i++) {
    const blup = db.create('blup', {
      flap: 'A',
    })

    users.push(
      db.create('user', {
        myBlup: blup,
        age: 99,
        name: 'Mr ' + i,
        burp: 66,
        snurp: 'derp derp',
        email: 'merp_merp_' + i + '@once.net',
        location: {
          label: 'BLA BLA',
        },
      }),
    )
  }

  const amount = 1
  for (let i = 0; i < amount; i++) {
    db.create('simple', {
      user: users[~~(Math.random() * users.length)],
      countryCode: 'aa',
      lilBlup: 1,
    })
  }

  db.drain()

  const result = db
    .query('simple')
    .include('user.name', 'user.myBlup.name')
    .range(0, 1)
    .get()

  deepEqual(result.toObject(), [
    {
      id: 1,
      user: {
        id: 1,
        name: 'Mr 0',
        myBlup: {
          id: 1,
          name: '',
        },
      },
    },
  ])
})
