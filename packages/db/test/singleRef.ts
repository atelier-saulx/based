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

  db.drain()

  const amount = 1e6
  for (let i = 0; i < amount; i++) {
    db.create('simple', {
      user,
      vectorClock: i,
      countryCode: 'aa',
      lilBlup: 1,
    })
  }

  db.drain()

  t.deepEqual(
    db.query('simple').include('id').range(0, 1).get().data.toObject(),
    [{ id: 1 }],
  )

  t.deepEqual(
    db.query('simple').include('user').range(0, 1).get().data.toObject(),
    [
      {
        id: 1,
        user: {
          id: 1,
          name: 'Jim de Beer',
          flap: 10,
          email: 'person@once.net',
          age: 99,
          snurp: '',
          burp: 0,
          location: { label: 'BLA BLA', x: 1, y: 2 },
        },
      },
    ],
  )

  t.deepEqual(
    db.query('simple').include('user.myBlup').range(0, 1).get().data.toObject(),
    [{ id: 1, user: { id: 1, myBlup: { id: 1, flap: 'A', name: 'blup !' } } }],
  )

  t.deepEqual(
    db
      .query('simple')
      .include('user.myBlup', 'lilBlup')
      .range(0, 1)
      .get()
      .data.toObject(),
    [
      {
        id: 1,
        user: { id: 1, myBlup: { id: 1, flap: 'A', name: 'blup !' } },
        lilBlup: { id: 1, flap: 'A', name: 'blup !' },
      },
    ],
  )

  t.deepEqual(
    db
      .query('simple')
      .include('user.myBlup', 'lilBlup', 'user.name')
      .range(0, 1)
      .get()
      .data.toObject(),
    [
      {
        id: 1,
        user: {
          id: 1,
          myBlup: { id: 1, flap: 'A', name: 'blup !' },
          name: 'Jim de Beer',
        },
        lilBlup: { id: 1, flap: 'A', name: 'blup !' },
      },
    ],
  )

  t.deepEqual(
    db
      .query('simple')
      .include('user.location.label')
      .range(0, 1)
      .get()
      .data.toObject(),
    [{ id: 1, user: { id: 1, location: { label: 'BLA BLA' } } }],
  )

  t.deepEqual(
    db
      .query('simple')
      .include('user.location')
      .range(0, 1)
      .get()
      .data.toObject(),
    [{ id: 1, user: { id: 1, location: { label: 'BLA BLA', x: 1, y: 2 } } }],
  )

  t.deepEqual(
    db
      .query('simple')
      .include('user', 'user.myBlup', 'lilBlup')
      .range(0, 1)
      .get()
      .data.toObject(),
    [
      {
        id: 1,
        user: {
          id: 1,
          myBlup: { id: 1, flap: 'A', name: 'blup !' },
          name: 'Jim de Beer',
          flap: 10,
          email: 'person@once.net',
          age: 99,
          snurp: '',
          burp: 0,
          location: { label: 'BLA BLA', x: 1, y: 2 },
        },
        lilBlup: { id: 1, flap: 'A', name: 'blup !' },
      },
    ],
  )
})
