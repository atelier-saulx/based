import { DbClient } from '../src/client/index.js'
import { BasedDb } from '../src/index.js'
import { DbServer } from '../src/server/index.js'
import { deepEqual, throws } from './shared/assert.js'
import test from './shared/test.js'

await test('client server', async (t) => {
  const server = new DbServer({
    path: t.tmp,
    onSchemaChange(schema) {
      client1.putLocalSchema(schema)
      client2.putLocalSchema(schema)
    },
  })

  await server.start({ clean: true })

  t.after(() => {
    return server.destroy()
  })

  const hooks = {
    async putSchema(schema, fromStart) {
      return server.putSchema(schema, fromStart)
    },
    async flushModify(buf) {
      const offsets = server.modify(buf)
      return { offsets }
    },
    async getQueryBuf(buf) {
      return server.getQueryBuf(buf)
    },
  }

  const client1 = new DbClient({
    hooks,
  })

  const client2 = new DbClient({
    hooks,
  })

  await client1.putSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  const youzi = await client1.create('user', {
    name: 'youzi',
  })

  const jamez = await client2.create('user', {
    name: 'jamez',
  })

  deepEqual(await client2.query('user').get().toObject(), [
    { id: 1, name: 'youzi' },
    { id: 2, name: 'jamez' },
  ])
})
