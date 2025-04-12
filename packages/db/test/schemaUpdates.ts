import { setTimeout } from 'node:timers/promises'
import { DbClient, DbClientHooks } from '../src/client/index.js'
import { DbServer } from '../src/server/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import { BasedDb } from '../src/index.js'

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

  await client1.setSchema({
    types: {
      rando: {
        power: 'boolean',
      },
      user: {
        age: 'uint8',
      },
    },
  })

  const ageSorted3 = await client1
    .query('user')
    .sort('age', 'asc')
    .get()
    .toObject()

  deepEqual(ageSorted3, ageSorted2)
})

await test('rapid schema updates', async (t) => {
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

  await client2.create('user', {
    name: 'youzi',
  })

  await client1.create('user', {
    name: 'jamez',
  })

  let field = 10
  const promises = []
  while (field--) {
    await setTimeout(10 + Math.random() * 100)
    promises.push(
      client1.setSchema({
        types: {
          // @ts-ignore
          user: {
            name: 'string',
            [`field${field}`]: 'string',
          },
        },
      }),
    )
    promises.push(
      client2.setSchema({
        types: {
          // @ts-ignore
          user: {
            [`field${field}`]: 'string',
            name: 'string',
          },
        },
      }),
    )
  }

  await Promise.all(promises)

  const res = await client1.query('user').get().toObject()

  deepEqual(
    [
      { id: 1, name: 'youzi', field0: '' },
      { id: 2, name: 'jamez', field0: '' },
    ],
    res,
  )
})

await test('rapid modifies during schema update', async (t) => {
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

  const youzies = 500_000
  let a = youzies
  while (a--) {
    client2.create('user', {
      name: 'youzi' + a,
    })
  }
  await client2.drain()

  client1.setSchema({
    types: {
      user: {
        age: 'number',
        name: 'string',
      },
    },
  })

  const jamesies = 1000
  let b = jamesies
  while (b--) {
    const name = 'jamex' + b
    const id = await client2.create('user', { name })
    const res = await client2.query('user', id).get().toObject()

    deepEqual(res.id, id)
    deepEqual(res.name, name)
  }

  const all = await client2.query('user').range(0, 1000_000).get().toObject()
  deepEqual(all[0], { id: 1, name: 'youzi499999' })
  deepEqual(all.at(-1), { id: 501000, name: 'jamex0' })
  deepEqual(all.length, youzies + jamesies)
})

await test('csmt after schema update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
    types: {
      nurp: {
        props: {
          email2: { type: 'string' },
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
          email: { type: 'string' },
        },
      },
    },
  })

  await db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp',
  })

  await db.setSchema({
    types: {
      nurp: {
        props: {
          email2: { type: 'string' },
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
          email: { type: 'string' },
        },
      },
    },
  })

  await db.create('user', {
    name: 'dr youz',
  })

  await db.save()
})
