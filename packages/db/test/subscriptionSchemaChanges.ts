import { wait } from '@saulx/utils'
import { DbClient, DbClientHooks } from '../src/client/index.js'
import { BasedDb, BasedQueryResponse } from '../src/index.js'
import { DbServer } from '../src/server/index.js'
import test from './shared/test.js'
import { registerQuery } from '../src/client/query/registerQuery.js'
import { equal } from 'assert'
import { deepEqual } from './shared/assert.js'

const start = async (t, clientsN = 2) => {
  const hooks: DbClientHooks = {
    async setSchema(schema, fromStart, transformFns) {
      schema = { ...schema }
      const { ...res } = await server.setSchema(schema, fromStart, transformFns)
      return res
    },
    async flushModify(buf) {
      buf = new Uint8Array(buf)
      const offsets = server.modify(buf)
      return { offsets }
    },
    async getQueryBuf(buf) {
      buf = new Uint8Array(buf)
      const res = await server.getQueryBuf(buf)
      return res
    },
    subscribe(q, onData, onError) {
      let timer: ReturnType<typeof setTimeout>
      let prevChecksum: number
      let lastLen = 0
      let response: BasedQueryResponse
      let killed = false

      const get = async () => {
        const schemaVersion = q.def.schemaChecksum
        if (schemaVersion && schemaVersion !== server.schema.hash) {
          if (q.db.schema.hash === server.schema.hash) {
            if (killed) {
              return
            }
            q.reBuildQuery()
            registerQuery(q)
            response = undefined
            get()
          } else {
            if (killed) {
              return
            }
            timer = setTimeout(get, 100)
            return
          }
        } else {
          const res = await server.getQueryBuf(q.buffer)
          if (res.byteLength === 0) {
            //
          }

          if (!response) {
            response = new BasedQueryResponse(q.id, q.def, res, 0)
          } else {
            response.result = res
            response.end = res.byteLength
          }
          const checksum = response.checksum
          if (killed) {
            return
          }
          if (lastLen != res.byteLength || checksum != prevChecksum) {
            onData(response)
            lastLen = res.byteLength
            prevChecksum = checksum
          }
          timer = setTimeout(get, 100)
          return
        }
      }
      get()
      return () => {
        killed = true
        clearTimeout(timer)
      }
    },
  }
  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: { ...hooks },
      }),
  )
  const server = new DbServer({
    path: t.tmp,
    onSchemaChange(schema) {
      for (const client of clients) {
        client.putLocalSchema(schema)
      }
    },
  })
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

  await wait(100)
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

  await wait(500)
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

  await wait(100)
  equal(cnt, 2, 'fired 2 times')
  deepEqual(
    subResults,
    [
      [{ id: 1, derp: 20, lang: 'de', friends: [] }],
      [{ id: 1, derp: 100, lang: 'de', friends: [] }],
    ],
    'sub results correct',
  )

  await wait(100)
})

await test('default subscription schema changes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.setSchema({
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

  await db.create('user', {
    derp: 20,
    lang: 'de',
  })

  let cnt = 0

  const q = db
    .query('user')
    .include('derp', 'lang')
    .include((s) => {
      s('friends').include('*')
    })
    .filter('lang', '=', 'de')

  const result1 = q.get().toObject()

  await db.setSchema({
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

  await wait(100)
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

  await wait(500)
  await db.setSchema({
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

  await db.update('user', 1, {
    derp: 100,
  })

  await wait(500)
  equal(cnt > 1, 'fired more then 1 times')
  deepEqual(
    subResults,
    [
      [{ id: 1, derp: 20, lang: 'de', friends: [] }],
      [{ id: 1, derp: 100, lang: 'de', friends: [] }],
    ],
    'sub results correct',
  )

  await wait(100)
})
