import test from './shared/test.js'
import { start } from './shared/multi.js'

await test('client server rapid fire', async (t) => {
  const promises: any[] = []
  const clientsN = 2
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
    const userIds: any[] = []
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
