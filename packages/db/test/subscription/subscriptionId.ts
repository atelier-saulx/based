import { wait } from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/hooks.js'
import { equal } from 'assert'

const start = async (t, clientsN = 2, time = 200) => {
  const server = new DbServer({
    path: t.tmp,
  })
  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: getDefaultHooks(server, time),
      }),
  )
  await server.start({ clean: true })
  t.after(() => server.destroy())
  return { clients, server }
}

await test('subscriptionId', async (t) => {
  const clientsN = 2
  const { clients } = await start(t, clientsN, 1)

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
  var idFieldCounter = 0

  const close = clients[0].query('user', id).subscribe((d) => {
    idCounter++
  })

  const close2 = clients[0]
    .query('user', id)
    .include('name')
    .subscribe((d) => {
      idFieldCounter++
    })

  const interval = setInterval(() => {
    clients[0].update('user', id, {
      x: { increment: 1 },
    })
  }, 10)

  t.after(() => {
    clearInterval(interval)
  })

  await wait(10)
  clients[0].update('user', id, {
    name: 'SnurtMcGurt',
  })

  await wait(10)
  clients[0].update('user', id, {
    name: 'SnurtMcGurt!!!',
  })

  await wait(80)

  equal(idCounter >= 10, true)
  equal(idFieldCounter, 3)

  clearInterval(interval)

  close()
})

await test('update after remove before subs loop', async (t) => {
  const clientsN = 2
  const { clients, server } = await start(t, clientsN, 300)

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

  var cnt1 = 0
  var cnt2 = 0
  const close = clients[0].query('user', id).subscribe((d) => {
    cnt1++
  })
  const close2 = clients[0]
    .query('user', id)
    .include('name')
    .subscribe((d) => {
      cnt2++
    })
  await wait(100)
  clients[0].update('user', id, {
    name: 'SnurtMcGurt!!!',
  })
  await wait(100)
  close()
  await wait(1000)
  close2()
  await wait(1)
  equal(cnt2, 2)
  equal(cnt1, 1)
  equal(server.subscriptions.active, 0, 'remove all subs')
})

await test('same id over different types', async (t) => {
  const clientsN = 2
  const { clients, server } = await start(t, clientsN, 300)

  await clients[0].setSchema({
    types: {
      user: {
        date: 'timestamp',
        x: 'uint8',
        name: 'string',
      },
      flap: {
        date: 'timestamp',
        x: 'uint8',
        name: 'string',
      },
    },
  })

  const id = await clients[0].create('user', {
    name: 'mr user',
    date: 1,
  })

  const flapId = await clients[0].create('flap', {
    name: 'mr flap',
    date: 1,
  })

  var cnt1 = 0
  var cnt2 = 0

  const close = clients[0]
    .query('user', id)
    .include('name')
    .subscribe((d) => {
      cnt1++
    })

  const close2 = clients[0]
    .query('flap', flapId)
    .include('name')
    .subscribe((d) => {
      cnt2++
    })

  await wait(100)
  clients[0].update('user', id, {
    name: 'SnurtMcGurt!!!',
  })

  clients[0].update('flap', id, {
    name: 'SnurtMcGurt!!!',
  })

  await wait(1000)
  close()
  close2()
  await wait(1)
  equal(cnt1, 2)
  equal(cnt2, 2)
  equal(server.subscriptions.active, 0, 'remove all subs')
})
