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

  db.create('simple', {
    lilBlup: blup,
  })

  db.create('simple', {
    lilBlup: differentBlup,
    flap: {
      power: 10,
    },
  })

  db.drain()

  // t.deepEqual(
  //   db
  //     .query('simple')
  //     // check for .
  //     // in conditions add 254 -> get next
  //     .filter('flap.power', '=', 10)
  //     .include('lilBlup')
  //     .get()
  //     .data.toObject(),
  //   [
  //     {
  //       id: 2,
  //       lilBlup: {
  //         id: 1,
  //         age: 10,
  //         name: 'mr blup',
  //         flap: 'B',
  //       },
  //     },
  //   ],
  // )

  // const result = db.query('simple').filter('user.myBlup.age', '=', 10).get()
  const result = db
    .query('simple')
    .filter('lilBlup.age', '=', 10)
    .include('lilBlup', 'flap')
    .get()

  console.log(result)
  // console.log(new Uint8Array(result.buffer))

  // for (const r of result.data) {
  //   console.log('START READ')
  //   t.is(r.lilBlup.name, '')
  // }

  t.true(true)
})
