import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import { start } from './shared/multi.js'

await test('client server basic', async (t) => {
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

  await client1.isModified()

  const marie = await client2.create('user', {
    name: 'marie',
  })

  const res = await client1.update('user', youzi, {
    name: 'youzi',
    others: [fred, marie],
    favoriteUser: marie,
  })

  deepEqual(
    await client1.query('user', res).include('*', '**').get(),
    {
      id: 1,
      age: 0,
      name: 'youzi',
      others: [
        { id: 3, age: 0, name: 'fred' },
        { id: 4, age: 0, name: 'marie' },
      ],
      favoriteUser: { id: 4, age: 0, name: 'marie' },
    },
    'correct favouritUser and other for youzi',
  )
})

await test('client server rapid fire', async (t) => {
  const promises = []
  const clientsN = 1
  const nodesN = 100
  const multi = 2
  const { clients } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        name: 'string',
        users: {
          items: {
            ref: 'user',
            prop: 'users',
          },
        },
      },
    },
  })

  await new Promise<void>((resolve) => {
    const userIds = []
    let i = nodesN
    let interval = setInterval(async () => {
      if (i) {
        const clientI = i-- % clients.length
        const client = clients[clientI]
        const cnt = nodesN - i
        let j = multi
        while (j--) {
          promises.push(
            (async () => {
              const userId = await client.create('user', {
                name: `user${clientI} ${cnt}`,
                users: userIds.slice(-1000, -1),
              })
              userIds.push(userId)
            })(),
            client.query('user').sort('name').include('name', 'users').get(),
          )
        }
      } else {
        clearInterval(interval)
        resolve()
      }
    }, 10)
  })

  await Promise.all(promises)
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
