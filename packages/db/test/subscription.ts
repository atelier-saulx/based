import { wait } from '@saulx/utils'
import { DbClient, DbClientHooks } from '../src/client/index.js'
import { BasedQueryResponse } from '../src/index.js'
import { DbServer } from '../src/server/index.js'
import test from './shared/test.js'
import { equal } from './shared/assert.js'

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
        }
        setTimeout(get, 10)
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
  t.after(() => {
    return server.destroy()
  })
  return { clients, server }
}

await test('subscription', async (t) => {
  const clientsN = 2
  const { clients } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        derp: 'uint8',
      },
    },
  })

  const x = await clients[0].create('user', {
    derp: 1,
  })

  let cnt = 0

  const close = clients[1]
    .query('user')
    .include('*')
    .subscribe((q) => {
      cnt++
    })

  console.log(await clients[1].query('user').get())

  let setCnt = 0
  const interval = setInterval(async () => {
    await clients[0].update('user', x, {
      derp: { increment: 1 },
    })
    setCnt++
  }, 200)

  t.after((t) => {
    clearInterval(interval)
  })

  await wait(2e3)

  equal(cnt - 1, setCnt, 'Incoming subs is equal to sets')

  close()
  clearInterval(interval)
  await wait(10)
})
