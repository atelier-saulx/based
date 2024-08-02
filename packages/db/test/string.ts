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

  const blup = db.create('blup', {
    flap: 'A',
  })

  const user = db.create('user', {
    myBlup: blup,
    age: 99,
    burp: 66,
    snurp: 'derp derp',
    email: 'merp_merp@once.net',
    location: {
      label: 'BLA BLA',
    },
  })

  db.create('simple', {
    user: user,
    lilBlup: blup,
  })

  db.drain()

  console.log(db.query('user').get())

  const result = db.query('user').get()
  t.deepEqual(result.data.toObject(), [
    {
      id: 1,
      name: '',
      flap: 0,
      email: 'merp_merp@once.net',
      age: 99,
      snurp: '',
      burp: 66,
      location: { label: '', x: 0, y: 0 },
    },
  ])

  console.info(new Uint8Array(result.buffer))

  // // if ! include include all
  // console.log(
  //   db.query('simple').include('user', 'user.myBlup', 'lilBlup').get(),
  // )

  t.true(true)
})
