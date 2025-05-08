import { wait } from '@saulx/utils'
import { DbClient } from '../src/client/index.js'
import { BasedDb, getDefaultHooks } from '../src/index.js'
import { DbServer } from '../src/server/index.js'
import test from './shared/test.js'
import { equal } from 'assert'
import { deepEqual } from './shared/assert.js'

const start = async (t, clientsN = 2) => {
  const server = new DbServer({
    path: t.tmp,
    onSchemaChange(schema) {
      for (const client of clients) {
        client.putLocalSchema(schema)
      }
    },
  })

  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: getDefaultHooks(server, 10),
      }),
  )

  await server.start({ clean: true })
  t.after(() => server.destroy())
  return { clients, server }
}

await test('subscription schema changes', async (t) => {
  const clientsN = 2
  const { clients } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        derp: 'uint8',
        location: 'string',
        lang: 'string',
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })

  await clients[0].create('user', {
    derp: 20,
    lang: 'de',
  })
  let cnt = 0
  const q = clients[1]
    .query('user')
    .include('derp', 'lang')
    .include((s) => {
      s('friends').include('*')
    })
    .filter('lang', '=', 'de')
  const result1 = q.get().toObject()
  await clients[0].setSchema({
    types: {
      user: {
        flap: 'uint16',
        derp: 'uint8',
        location: 'string',
        lang: { type: 'string', maxBytes: 2 },
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })
  await wait(20)
  q.reBuildQuery()
  deepEqual(result1, q.get(), 'first schema change results are correct')
  const subResults = []
  const close = q.subscribe((q) => {
    subResults.push(q.toObject())
    cnt++
  })
  t.after(() => {
    close()
  })
  await wait(20)
  await clients[0].setSchema({
    types: {
      user: {
        flap: 'uint16',
        derp: 'uint8',
        location: 'string',
        lang: { type: 'string', maxBytes: 4 },
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })
  await clients[0].update('user', 1, {
    derp: 100,
  })
  await wait(20)
  equal(cnt, 3, 'fired 3 times')
  deepEqual(
    subResults,
    [
      [{ id: 1, derp: 20, lang: 'de', friends: [] }],
      [{ id: 1, derp: 20, lang: 'de', friends: [] }],
      [{ id: 1, derp: 100, lang: 'de', friends: [] }],
    ],
    'sub results correct',
  )
})

await test('better subscription schema changes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  const results = []
  db.query('user').subscribe((res) => {
    const obj = res.toObject()
    results.push(obj)
  })

  await wait(300)

  await db.create('user', {
    name: 'youzi',
  })

  await wait(300)

  await db.setSchema({
    types: {
      user: {
        name: 'string',
        nice: 'boolean',
      },
    },
  })

  await wait(300)

  await db.create('user', {
    name: 'jamex',
  })

  await wait(300)

  await db.setSchema({
    types: {
      user: {
        nice: 'boolean',
      },
    },
  })

  await wait(300)

  deepEqual(results, [
    [],
    [{ id: 1, name: 'youzi' }],
    [{ id: 1, nice: false, name: 'youzi' }],
    [
      { id: 1, nice: false, name: 'youzi' },
      { id: 2, nice: false, name: 'jamex' },
    ],
    [
      { id: 1, nice: false },
      { id: 2, nice: false },
    ],
  ])
})
