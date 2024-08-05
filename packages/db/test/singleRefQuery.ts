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
      // user: {
      //   fields: {
      //     name: { type: 'string' },
      //     myBlup: { type: 'reference', allowedType: 'blup' },
      //   },
      // },
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
          lilBlup: { type: 'reference', allowedType: 'blup' },
          // user: { type: 'reference', allowedType: 'user' },
        },
      },
    },
  })

  const blup = db.create('blup', {
    flap: 'B',
    age: 10,
    name: 'mr blup',
  })

  db.create('blup', {
    flap: 'C',
    age: 20,
    name: 'mr blup 2',
  })

  db.create('simple', {
    // user: db.create('user', {
    //   name: 'mr snurp',
    //   myBlup: blup,
    // }),
    lilBlup: blup,
  })

  db.drain()

  const result = db
    .query('simple')
    // check for .
    // in conditions add 254 -> get next
    .filter('lilBlup.age', '=', 10)
    .include('lilBlup')
    .get()

  console.log(new Uint8Array(result.buffer))

  for (const r of result.data) {
    console.log('START READ')
    t.is(r.lilBlup.name, '')
  }
})
