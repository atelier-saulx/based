import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.serial.only('single reference', async (t) => {
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
      blup: {
        fields: {
          // @ts-ignore
          flap: { type: 'string', maxBytes: 1 },
          name: { type: 'string' },
        },
      },
      simple: {
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
    name: 'blup !',
    flap: 'A',
  })

  const user = db.create('user', {
    myBlup: blup,
    age: 99,
    name: 'Jim de Beer',
    email: 'person@once.net',
    flap: 10,
    location: {
      label: 'BLA BLA',
      x: 1,
      y: 2,
    },
  })

  const amount = 1e6
  for (let i = 0; i < amount; i++) {
    db.create('simple', {
      user,
      vectorClock: i,
      countryCode: 'aa',
      lilBlup: blup,
    })
  }

  db.drain()

  // t.deepEqual(
  //   db.query('simple').include('id').range(0, 1).get().data.toObject(),
  //   [{ id: 1 }],
  // )

  // t.deepEqual(
  //   db.query('simple').include('user').range(0, 1).get().data.toObject(),
  //   [
  //     {
  //       id: 1,
  //       user: {
  //         id: 1,
  //         name: 'Jim de Beer',
  //         flap: 10,
  //         email: 'person@once.net',
  //         age: 99,
  //         snurp: '',
  //         burp: 0,
  //         location: { label: 'BLA BLA', x: 1, y: 2 },
  //       },
  //     },
  //   ],
  // )

  // t.deepEqual(
  //   db.query('simple').include('user.myBlup').range(0, 1).get().data.toObject(),
  //   [{ id: 1, user: { id: 1, myBlup: { id: 1, flap: 'A', name: 'blup !' } } }],
  // )

  // t.deepEqual(
  //   db
  //     .query('simple')
  //     .include('user.myBlup', 'lilBlup')
  //     .range(0, 1)
  //     .get()
  //     .data.toObject(),
  //   [
  //     {
  //       id: 1,
  //       user: { id: 1, myBlup: { id: 1, flap: 'A', name: 'blup !' } },
  //       lilBlup: { id: 1, flap: 'A', name: 'blup !' },
  //     },
  //   ],
  // )

  // t.deepEqual(
  //   db
  //     .query('simple')
  //     .include('user.myBlup', 'lilBlup', 'user.name')
  //     .range(0, 1)
  //     .get()
  //     .data.toObject(),
  //   [
  //     {
  //       id: 1,
  //       user: {
  //         id: 1,
  //         myBlup: { id: 1, flap: 'A', name: 'blup !' },
  //         name: 'Jim de Beer',
  //       },
  //       lilBlup: { id: 1, flap: 'A', name: 'blup !' },
  //     },
  //   ],
  // )

  // t.deepEqual(
  //   db
  //     .query('simple')
  //     .include('user.location.label')
  //     .range(0, 1)
  //     .get()
  //     .data.toObject(),
  //   [{ id: 1, user: { id: 1, location: { label: 'BLA BLA' } } }],
  // )

  // t.deepEqual(
  //   db
  //     .query('simple')
  //     .include('user.location')
  //     .range(0, 1)
  //     .get()
  //     .data.toObject(),
  //   [{ id: 1, user: { id: 1, location: { label: 'BLA BLA', x: 1, y: 2 } } }],
  // )

  // goes wrong if the refs are the same...
  // console.dir(
  //   db
  //     .query('simple')
  //     .include('user', 'user.myBlup', 'lilBlup')
  //     .range(0, 1)
  //     .get()
  //     .data.toObject(),
  //   { depth: 10 },
  // )

  db.create('simple', {
    user,
    vectorClock: 1e6,
    countryCode: 'aa',
    lilBlup: db.create('blup', {
      name: 'blup ! 2',
      flap: 'B',
    }),
  })

  db.drain()

  const result = db
    .query('simple')
    .filter('vectorClock', '=', 1e6)
    .include('user', 'user.myBlup', 'lilBlup')
    .range(0, 1)
    .get()

  const logger = (x, empty = '') => {
    for (const key in x) {
      if (key === 'fromRef') {
        console.log(empty, key, ':', `[${x[key].path.join('.')}]`)
      } else if (key !== 'schema' && key !== 'includeTree') {
        if (key === 'refIncludes') {
          console.log(empty, ' -- ref includes!')
          for (const k in x[key]) {
            console.log(empty, ' -- STARRT: ', k)
            logger(x[key][k], empty + '  ')
          }
        } else {
          console.log(empty, key, ':', x[key])
        }
      }
    }
    if (!empty) {
      console.log('\n')
    }
  }

  logger(result.query.includeDef)

  console.dir(result.data.toObject(), { depth: 10 })

  console.dir(new Uint8Array(result.buffer), { depth: 10 })

  // .data.toObject(),
  // { depth: 10 },
  // )

  // t.deepEqual(
  //   db
  //     .query('simple')
  //     .include('user', 'user.myBlup', 'lilBlup')
  //     .range(0, 1)
  //     .get()
  //     .data.toObject(),
  //   [
  //     {
  //       id: 1,
  //       user: {
  //         id: 1,
  //         myBlup: { id: 1, flap: 'A', name: 'blup !' },
  //         name: 'Jim de Beer',
  //         flap: 10,
  //         email: 'person@once.net',
  //         age: 99,
  //         snurp: '',
  //         burp: 0,
  //         location: { label: 'BLA BLA', x: 1, y: 2 },
  //       },
  //       lilBlup: { id: 1, flap: 'A', name: 'blup !' },
  //     },
  //   ],
  // )

  t.true(true)
})
