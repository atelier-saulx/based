import test from 'ava'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.serial('update', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
    // maxModifySize: 1024 * 1024 * 1000,
  })

  db.updateSchema({
    types: {
      mep: {
        fields: {
          a: { type: 'integer' },
          // @ts-ignore
          countryCode: { type: 'string', maxBytes: 10 },
          b: { type: 'integer' },
          c: { type: 'integer' },
        },
      },
      snurp: {
        fields: {
          a: { type: 'integer' },
          // @ts-ignore
          countryCode: { type: 'string', maxBytes: 2 },
          b: { type: 'integer' },
          c: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string' },
          nested: {
            type: 'object',
            properties: {
              // @ts-ignore
              derp: { type: 'string', maxBytes: 1 },
            },
          },
        },
      },
    },
  })

  const snurp = db.create('snurp', {
    name: 'mr snurp',
    email: 'snurp@snurp.snurp',
    a: 1,
    b: 2,
    c: 3,
    countryCode: 'NL',
  })

  const snurp2 = db.create('snurp', {
    name: 'mr snurp 2',
  })

  db.drain()

  t.deepEqual(db.query('snurp').get().toObject(), [
    {
      a: 1,
      b: 2,
      c: 3,
      countryCode: 'NL',
      email: 'snurp@snurp.snurp',
      id: 1,
      name: 'mr snurp',
      nested: {
        derp: '',
      },
    },
    {
      a: 0,
      b: 0,
      c: 0,
      email: '',
      countryCode: '',
      id: 2,
      name: 'mr snurp 2',
      nested: {
        derp: '',
      },
    },
  ])

  db.update('snurp', snurp, {
    name: 'mr snurp!',
    nested: {
      derp: 'a',
    },
  })

  db.drain()

  db.update('snurp', snurp2, {
    name: 'mr snurp 2!',
    nested: {
      derp: 'b',
    },
  })

  db.drain()

  t.deepEqual(db.query('snurp').get().toObject(), [
    {
      a: 1,
      b: 2,
      c: 3,
      countryCode: 'NL',
      email: 'snurp@snurp.snurp',
      id: 1,
      name: 'mr snurp!',
      nested: {
        derp: 'a',
      },
    },
    {
      a: 0,
      b: 0,
      c: 0,
      countryCode: '',
      email: '',
      id: 2,
      name: 'mr snurp 2!',
      nested: {
        derp: 'b',
      },
    },
  ])

  db.drain()

  t.deepEqual(db.query('snurp', 2).get().toObject(), {
    a: 0,
    b: 0,
    c: 0,
    countryCode: '',
    email: '',
    id: 2,
    name: 'mr snurp 2!',
    nested: {
      derp: 'b',
    },
  })

  // for individual queries combine them
  t.deepEqual(db.query('snurp', [2, 1]).get().toObject(), [
    {
      a: 1,
      b: 2,
      c: 3,
      countryCode: 'NL',
      email: 'snurp@snurp.snurp',
      id: 1,
      name: 'mr snurp!',
      nested: {
        derp: 'a',
      },
    },
    {
      a: 0,
      b: 0,
      c: 0,
      countryCode: '',
      email: '',
      id: 2,
      name: 'mr snurp 2!',
      nested: {
        derp: 'b',
      },
    },
  ])

  // ------------------------------
  const ids = []
  for (let i = 0; i < 1e6; i++) {
    ids.push(i)
    db.create('snurp', {
      a: i,
      name: 'mr snurp ' + i,
      nested: {
        derp: 'b',
      },
    })
  }
  db.drain()

  console.log(db.query('snurp', ids).get())

  let total = 0
  let len = 0
  for (var j = 0; j < 1; j++) {
    let x = 0
    const d = Date.now()

    for (var i = 0; i < 1e5; i++) {
      x += db.query('snurp', i).include('a').get().execTime
    }
    console.log(Date.now() - d, 'ms', 'db time', x, 'ms')
    total += x
    len++
  }

  console.log('TOTAL', 'db time', total / len, 'ms', 0)
})
