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
    maxModifySize: 1e4,
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

test.serial.only('string + refs', async (t) => {
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
      // name: 'blup ! ' + i,
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

  t.deepEqual(result.data.toObject(), [
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
