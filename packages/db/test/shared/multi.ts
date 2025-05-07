import { DbClient, DbClientHooks } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import { setTimeout } from 'node:timers/promises'

export const start = async (t, clientsN = 2) => {
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
      let offsets = server.modify(buf)
      offsets = offsets && { ...offsets }
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

  t.after(async () => {
    await server.destroy()
    await Promise.all(clients.map((c) => c.destroy()))
  })

  return { clients, server }
}
