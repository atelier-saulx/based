import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb, createBuffer, parseBuffer } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test('set and simple get', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
  })

  db.updateSchema({
    types: {
      simple: {
        fields: {
          user: { type: 'reference', allowedTypes: ['user'] },
          vectorClock: { type: 'integer' },
          location: {
            type: 'object',
            properties: {
              long: { type: 'number' },
              lat: { type: 'number' },
            },
          },
        },
      },

      vote: {
        fields: {
          refs: { type: 'references' },
          user: { type: 'reference', allowedTypes: ['user'] },
          vectorClock: { type: 'integer' },
          location: {
            type: 'object',
            properties: {
              long: { type: 'number' },
              lat: { type: 'number' },
            },
          },
        },
      },
      complex: {
        fields: {
          flap: {
            type: 'integer',
          },
          value: {
            type: 'integer',
          },
          nip: {
            type: 'string',
          },
          mep: {
            type: 'number',
          },
          created: {
            type: 'timestamp',
          },
          updated: {
            type: 'timestamp',
          },
          gerp: {
            type: 'reference',
            allowedTypes: ['vote'],
          },
          snurp: {
            type: 'object',
            properties: {
              refTime: { type: 'references', allowedTypes: ['vote'] },
              ups: { type: 'references', allowedTypes: ['vote'] },
              derp: { type: 'integer' },
              bla: { type: 'string' },
              hup: {
                type: 'object',
                properties: {
                  start: {
                    type: 'timestamp',
                  },
                  x: { type: 'integer' },
                  isDope: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  })

  const id = db.create('complex', {
    value: 666,
    nip: 'FRANKO!',
    gerp: 999,
    snurp: { bla: 'yuzi', ups: [1, 2, 3, 4, 5] },
  })

  await wait(0)

  t.deepEqual(db.get('complex', id), {
    snurp: {
      refTime: [],
      hup: { start: 0, x: 0, isDope: false },
      ups: [1, 2, 3, 4, 5],
      derp: 0,
      bla: 'yuzi',
    },
    updated: 0,
    created: 0,
    mep: 0,
    flap: 0,
    value: 666,
    nip: 'FRANKO!',
    gerp: 999,
  })

  const doesNotExist = db.get('simple', 0)

  // TODO franky when DBI does not exist and error zig will never work again...
  t.deepEqual(doesNotExist, {
    location: { lat: 0, long: 0 },
    user: 0,
    vectorClock: 0,
  })

  const id1 = db.create('simple', {
    user: 1,
    vectorClock: 20,
    location: {
      long: 52.0123,
      lat: 52.213,
    },
  })

  await wait(0)
  t.is(Math.round(db.get('simple', id1).location.long * 10000) / 10000, 52.0123)

  const refs = []
  for (let i = 0; i < 1e4; i++) {
    refs.push(i)
  }

  const id2 = db.create('vote', {
    user: 1,
    vectorClock: 22,
    location: {
      long: 52.1,
      lat: 52.2,
    },
    refs,
  })
  await wait(0)
  t.is(db.get('vote', id2).vectorClock, 22)
  t.is(db.get('vote', id2).refs.length, 1e4)

  let d = Date.now()
  let lId = 0
  for (let i = 0; i < 2e6; i++) {
    lId = db.create('simple', {
      user: 1,
      vectorClock: i,
      location: {
        long: 52,
        lat: 52,
      },
    })
  }
  await wait(0)
  console.info('perf', Date.now() - d, 'ms', '2M inserts (2 dbis)')

  t.deepEqual(db.get('simple', lId), {
    user: 1,
    vectorClock: 2e6 - 1,
    location: {
      long: 52,
      lat: 52,
    },
  })
})

test('get include', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
  })

  db.updateSchema({
    types: {
      something: {
        fields: {
          flap: { type: 'string' },
          user: { type: 'reference', allowedTypes: ['user'] },
          vectorClock: { type: 'integer' },
          location: {
            type: 'object',
            properties: {
              long: { type: 'number' },
              lat: { type: 'number' },
            },
          },
        },
      },
    },
  })

  const id = db.create('something', {
    user: 1,
    flap: 'hello',
    vectorClock: 20,
    location: {
      long: 52.0123,
      lat: 52.213,
    },
  })

  await wait(0)

  console.info(db.get('something', id, ['location.long', 'flap']))

  t.pass()
})

test.only('query + filter', async (t) => {
  const db = new BasedDb({
    path: dbFolder,
  })

  db.updateSchema({
    types: {
      simple: {
        fields: {
          flap: { type: 'string' },
          refs: { type: 'references', allowedTypes: ['user'] },
          user: { type: 'reference', allowedTypes: ['user'] },
          vectorClock: { type: 'integer' },
          location: {
            type: 'object',
            properties: {
              long: { type: 'number' },
              lat: { type: 'number' },
            },
          },
        },
      },
    },
  })

  const refs = []
  for (let i = 1; i < 1e3 - 1; i++) {
    refs.push(i)
  }

  for (let i = 0; i < 1e5 - 1; i++) {
    db.create('simple', {
      user: 1,
      refs,
      flap: 'my flap flap flap ' + (i % 1000),
      vectorClock: 3,
      location: {
        long: 52,
        lat: 52,
      },
    })
  }

  await wait(0)

  const d = Date.now()
  const ids = db
    .query('simple')

    //

    .filter(['flap', '=', 'my flap flap flap 1'])
    .filter(['vectorClock', '=', 3])
    .filter(['refs', '=', refs])
    .range(10, 10000) // -10 , 25
    .get()

  console.info('query result ==', ids, Date.now() - d, 'ms')

  t.true(true)
})
