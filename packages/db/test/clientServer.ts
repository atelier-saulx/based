import { DbClient, DbClientHooks } from '../src/client/index.js'
import { DbServer } from '../src/server/index.js'
import { deepEqual } from './shared/assert.js'
import { setTimeout } from 'node:timers/promises'
import test from './shared/test.js'

const start = async (t, clientsN = 2) => {
  const hooks: DbClientHooks = {
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

await test('client server', async (t) => {
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

  const marie = client2.create('user', {
    name: 'marie',
  })

  await client1.isModified()
  await client2.isModified()

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

await test('client server rapid fire', async (t) => {
  const promises = []
  const clientsN = 4
  const nodesN = 1000

  const { clients } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  await new Promise<void>((resolve) => {
    let i = ~~(nodesN / clientsN)
    let interval = setInterval(() => {
      if (i--) {
        promises.push(
          clients.map(async (client, clientI) => {
            await setTimeout(~~(Math.random() * 100))
            await Promise.all([
              client.create('user', {
                name: `user${clientI} ${nodesN - i}`,
              }),
              client.query('user').get(),
            ])
          }),
        )
      } else {
        clearInterval(interval)
        resolve()
      }
    }, 5)
  })

  console.log('end interval', promises.length)
  await Promise.all(promises)

  console.log('done test!')

  const allUsers1 = await clients[0]
    .query('user')
    .range(0, 100_000)
    .get()
    .toObject()

  let id = 0
  for (const user of allUsers1) {
    id++
    if (user.id !== id) {
      console.log('incorrect', user, 'expected', id)
      throw new Error('incorrect id sequence')
    }
  }
})
