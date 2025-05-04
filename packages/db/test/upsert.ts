import { DbClient, DbClientHooks } from '../src/client/index.js'
import { DbServer } from '../src/server/index.js'
import { deepEqual } from './shared/assert.js'
import { setTimeout } from 'node:timers/promises'
import test from './shared/test.js'

const start = async (t, clientsN = 2) => {
  const hooks: DbClientHooks = {
    subscribe(q, onData, onError) {
      console.warn('Subscription not supported without based-server!')
      return () => {}
    },
    async setSchema(schema, fromStart, transformFns) {
      schema = { ...schema }
      await setTimeout(20)
      const { ...res } = await server.setSchema(schema, fromStart, transformFns)
      await setTimeout(~~(Math.random() * 100))
      return res
    },
    async flushModify(buf) {
      buf = new Uint8Array(buf)
      await setTimeout(20)
      const { ...offsets } = server.modify(buf)
      await setTimeout(~~(Math.random() * 100))
      return { offsets }
    },
    async getQueryBuf(buf) {
      buf = new Uint8Array(buf)
      await setTimeout(20)
      const res = await server.getQueryBuf(buf)
      await setTimeout(~~(Math.random() * 100))
      return res
    },
  }

  const server = new DbServer({
    path: t.tmp,
    // debug: true,
    onSchemaChange(schema) {
      for (const client of clients) {
        client.putLocalSchema(schema)
      }
    },
  })
  await server.start({ clean: true })

  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: { ...hooks },
      }),
  )

  t.after(() => server.destroy())

  return { clients, server }
}

await test('upsert', async (t) => {
  const {
    clients: [client1, client2],
  } = await start(t)
  await client1.setSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  const youzi = await client1.create('user', {
    name: 'youzi',
  })

  const jamez = await client1.create('user', {
    name: 'jamez',
  })

  deepEqual(await client1.query('user').get(), [
    { id: 1, name: 'youzi' },
    { id: 2, name: 'jamez' },
  ])
})
