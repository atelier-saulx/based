import { DbClient, DbClientHooks } from '../src/client/index.js'
import { DbServer } from '../src/server/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('client server schema updates', async (t) => {
  const server = new DbServer({
    path: t.tmp,
    onSchemaChange(schema) {
      client1.putLocalSchema(schema)
      client2.putLocalSchema(schema)
    },
  })

  await server.start({ clean: true })

  t.after(() => server.destroy())

  const hooks: DbClientHooks = {
    async setSchema(schema, fromStart, transformFns) {
      return server.setSchema(schema, fromStart, transformFns)
    },
    async flushModify(buf) {
      const offsets = server.modify(buf)
      return { offsets }
    },
    async getQueryBuf(buf) {
      return server.getQueryBuf(buf)
    },
    flushIsReady: new Promise(() => {}),
    flushReady: () => {},
    flushTime: 0,
  }

  const client1 = new DbClient({
    hooks,
  })

  const client2 = new DbClient({
    hooks,
  })

  await client1.setSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  await client1.create('user', {
    name: 'youzi',
  })

  await client1.create('user', {
    name: 'jamez',
  })

  deepEqual(await client1.query('user').get(), [
    { id: 1, name: 'youzi' },
    { id: 2, name: 'jamez' },
  ])

  await client1.setSchema({
    types: {
      user: {
        age: 'number',
      },
    },
  })

  deepEqual(await client1.query('user').get(), [
    { id: 1, age: 0 },
    { id: 2, age: 0 },
  ])

  const ageSorted = await client2
    .query('user')
    .sort('age', 'asc')
    .get()
    .toObject()

  await client1.setSchema({
    types: {
      user: {
        age: 'uint8',
      },
    },
  })

  const ageSorted2 = await client1
    .query('user')
    .sort('age', 'asc')
    .get()
    .toObject()

  deepEqual(ageSorted, ageSorted2)
})
