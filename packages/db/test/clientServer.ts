import { fileURLToPath } from 'url'
import { DbClient, DbClientHooks } from '../src/client/index.js'
import { DbServer } from '../src/server/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('client server', async (t) => {
  const server = new DbServer({
    path: t.tmp,
    onSchemaChange(schema) {
      console.log('server schema change hook')
      client1.putLocalSchema(schema)
      client2.putLocalSchema(schema)
    },
  })

  await server.start({ clean: true })

  t.after(() => {
    return server.destroy()
  })

  const hooks: DbClientHooks = {
    async setSchema(schema, fromStart, transformFns) {
      console.log('client schema hook flap')
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

  console.log('\n\n---------------------------')
  console.log('STEP 1: xx')

  await client1.setSchema({
    types: {
      user: {
        age: 'number',
      },
    },
  })

  console.log('Y ---')

  deepEqual(await client1.query('user').get(), [
    { id: 1, age: 0 },
    { id: 2, age: 0 },
  ])

  await client1.setSchema({
    types: {
      user: {
        name: 'string',
        age: 'number',
        others: {
          items: {
            ref: 'user',
            prop: 'others',
          },
        },
        favoriteUser: {
          ref: 'user',
          prop: 'favoriteUser',
        },
      },
    },
  })

  const fred = client1.create('user', {
    name: 'fred',
  })

  const marie = client1.create('user', {
    name: 'marie',
  })

  await client1.isModified()

  const res = await client1.update('user', youzi, {
    name: 'youzi',
    others: [fred, marie],
    favoriteUser: marie,
  })

  deepEqual(await client1.query('user', res).include('*', '**').get(), {
    id: 1,
    age: 0,
    name: 'youzi',
    others: [
      { id: 3, age: 0, name: 'fred' },
      { id: 4, age: 0, name: 'marie' },
    ],
    favoriteUser: { id: 4, age: 0, name: 'marie' },
  })
})
