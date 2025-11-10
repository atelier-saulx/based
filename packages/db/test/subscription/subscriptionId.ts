import { wait } from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/hooks.js'
import { equal } from 'assert'

const start = async (t, clientsN = 2) => {
  const server = new DbServer({
    path: t.tmp,
  })
  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: getDefaultHooks(server, 1),
      }),
  )
  await server.start({ clean: true })
  t.after(() => server.destroy())
  return { clients, server }
}

await test('subscriptionId', async (t) => {
  const clientsN = 2
  const { clients } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        date: 'timestamp',
        x: 'uint8',
        name: 'string',
      },
    },
  })

  const id = await clients[0].create('user', {
    name: 'mr flap',
    date: 'now',
  })

  var idCounter = 0
  var totalLen = 0

  const close = clients[0].query('user', id).subscribe((d) => {
    console.log(d)
    totalLen += d.length
    idCounter++
  })

  const interval = setInterval(() => {
    clients[0].update('user', id, {
      x: { increment: 1 },
    })
  }, 10)

  t.after(() => {
    clearInterval(interval)
  })

  await wait(100)

  equal(idCounter, 10)
  clearInterval(interval)

  close()
})
