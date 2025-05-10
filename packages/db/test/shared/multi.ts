import { DbClient, DbClientHooks } from '../../src/index.js'
import { DbServer } from '../../src/server/index.js'
import { setTimeout } from 'node:timers/promises'

export const start = async (t, clientsN = 2) => {
  const server = new DbServer({
    path: t.tmp,
  })
  const hooks: DbClientHooks = {
    subscribe() {
      console.warn('No sub hook here for reasons in multi / test')
      return () => {}
    },
    subscribeSchema: (setSchema) => {
      server.on('schema', (schema) => {
        setSchema(schema)
      })
    },
    async setSchema(schema, transformFns) {
      schema = { ...schema }
      await setTimeout(20)
      const res = await server.setSchema(schema, transformFns)
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
