import { DbClient } from '../src/client/index.js'
import { BasedDb } from '../src/index.js'
import { DbServer } from '../src/server/index.js'
import { deepEqual, throws } from './shared/assert.js'
import test from './shared/test.js'

await test('client server', async (t) => {
  const server = new DbServer({
    path: t.tmp,
  })

  await server.start({ clean: true })

  t.after(() => {
    return server.destroy()
  })

  const client = new DbClient({
    hooks: {
      async putSchema(schema, fromStart) {
        return server.putSchema(schema, fromStart)
      },
      async flushModify(buf) {
        server.modify(buf)
        return { offset: 0 }
      },
      async getQueryBuf(buf) {
        return server.getQueryBuf(buf)
      },
    },
  })

  await client.putSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  await client.create('user', {
    name: 'youzi',
  })
})
