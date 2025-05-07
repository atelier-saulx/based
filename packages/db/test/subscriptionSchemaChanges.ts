import { wait } from '@saulx/utils'
import { DbClient, DbClientHooks } from '../src/client/index.js'
import { BasedQueryResponse } from '../src/index.js'
import { DbServer } from '../src/server/index.js'
import test from './shared/test.js'
import { equal } from './shared/assert.js'
import { italy } from './shared/examples.js'

const start = async (t, clientsN = 2) => {
  const hooks: DbClientHooks = {
    async setSchema(schema, fromStart, transformFns) {
      schema = { ...schema }
      const { ...res } = await server.setSchema(schema, fromStart, transformFns)
      return res
    },
    async flushModify(buf) {
      buf = new Uint8Array(buf)
      const { ...offsets } = server.modify(buf)
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
      const get = async () => {
        const res = await server.getQueryBuf(q.buffer)
        if (!response) {
          response = new BasedQueryResponse(q.id, q.def, res, 0)
        } else {
          response.result = res
          response.end = res.byteLength
        }
        const checksum = response.checksum

        if (lastLen != res.byteLength || checksum != prevChecksum) {
          onData(response)
          lastLen = res.byteLength
          prevChecksum = checksum
        } else {
          // console.log(
          //   response.checksum,
          //   prevChecksum,
          //   response.result.subarray(-4),
          // )
          // response.debug()
        }
        timer = setTimeout(get, 100)
      }
      get()
      return () => {
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

  const x = await clients[0].create('user', {
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

  await q.get().inspect()

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

  // did this migrate?

  console.log('after schema update')
  await wait(100)
  q.reBuildQuery()
  await q.get().inspect().catch(console.error)

  // await clients[0]
  //   .query('user')
  //   .include('derp', 'lang')
  //   .filter('lang', '=', 'de')
  //   .get()
  //   .inspect()

  // const close = q.subscribe((q) => {
  //   cnt++
  // })

  // close()

  // add a list of things
})
