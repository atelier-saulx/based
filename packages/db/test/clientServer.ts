import { setTimeout } from 'timers/promises'
import { DbClient, DbClientHooks } from '../src/client/index.js'
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

  const hooks: DbClientHooks = {
    async putSchema(schema, fromStart, transformFns) {
      return server.putSchema(schema, fromStart, transformFns)
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

  const jamez = await client1.create('user', {
    name: 'jamez',
  })

  deepEqual(await client1.query('user').get().toObject(), [
    { id: 1, name: 'youzi' },
    { id: 2, name: 'jamez' },
  ])

  await client1.putSchema({
    types: {
      user: {
        age: 'number',
      },
    },
  })

  deepEqual(await client1.query('user').get().toObject(), [
    { id: 1, age: 0 },
    { id: 2, age: 0 },
  ])
})
