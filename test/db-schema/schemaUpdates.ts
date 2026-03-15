import { setTimeout } from 'node:timers/promises'
import { deepEqual } from '../shared/assert.js'
import test from '../shared/test.js'
import { wait } from '../../src/utils/index.js'
import { testDb, testDbClient, testDbServer } from '../shared/index.js'

await test('client server schema updates', async (t) => {
  const server = await testDbServer(t, { noBackup: true })
  const schema = {
    types: {
      user: {
        name: 'string',
      },
    },
  } as const
  const client1 = await testDbClient(server, schema)
  const client2 = await testDbClient<typeof schema>(server)

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

  const client1Updated = await client1.setSchema({
    types: {
      user: {
        age: 'number',
      },
    },
  })

  deepEqual(await client1Updated.query('user').get(), [
    { id: 1, age: 0 },
    { id: 2, age: 0 },
  ])

  const ageSorted = await client2.query('user').sort('age', 'asc').get()

  await client1.setSchema({
    types: {
      user: {
        age: 'uint8',
      },
    },
  })

  const ageSorted2 = await client1.query('user').sort('age', 'asc').get()

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

  const ageSorted3 = await client1.query('user').sort('age', 'asc').get()

  deepEqual(ageSorted3, ageSorted2)
})

await test('rapid schema updates', async (t) => {
  const server = await testDbServer(t, { noBackup: true })

  const client1 = await testDbClient(server)
  const client2 = await testDbClient(server)

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
  const promises: any[] = []
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

  const res = await client1.query('user').get()

  deepEqual(
    [
      { id: 1, name: 'youzi', field0: '' },
      { id: 2, name: 'jamez', field0: '' },
    ],
    res as any,
  )
})

await test('rapid modifies during schema update', async (t) => {
  const server = await testDbServer(t, { noBackup: true })
  const schema = {
    types: {
      user: {
        name: 'string',
      },
    },
  } as const
  const client1 = await testDbClient(server, schema)
  const client2 = await testDbClient<typeof schema>(server)

  const youzies = 500_000

  let a = youzies
  while (a--) {
    client2.create('user', {
      name: 'youzi' + a,
    })
  }

  await client2.drain()
  await client1.setSchema({
    types: {
      user: {
        age: 'number',
        name: 'string',
      },
    },
  })

  const jamesies = 1e3
  let b = jamesies
  while (b--) {
    const name = 'jamex' + b
    const id = await client2.create('user', { name })
    const res = (await client2.query('user', id).get())!

    deepEqual(res.id, id)
    deepEqual(res.name, name)
  }

  const all = (await client2.query('user').range(0, 1000_000).get())!
  // await wait(1e3)
  // console.log(all.length, all.slice(0, 10), all.slice(-10))
  deepEqual(all[0], { id: 1, name: 'youzi499999', age: 0 } as any)
  deepEqual(all.at(-1), { id: 501000, name: 'jamex0', age: 0 } as any)
  deepEqual(all.length, youzies + jamesies)
})

await test('tree after schema update', async (t) => {
  const db = await testDb(t, {
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
})
