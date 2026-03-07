import { wait } from '../../src/utils/index.js'
import { DbClient } from '../../src/db-client/index.js'
import { DbServer } from '../../src/db-server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/db-client/hooks.js'
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

await test('filter', async (t) => {
  const clientsN = 2
  const { clients } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        date: 'timestamp',
        x: 'uint8',
        name: 'string',
        gurk: 'string',
        flap: 'string',
        rurp: 'string',
      },
    },
  })

  const id = await clients[0].create('user', {
    name: 'mr flap',
    date: 'now',
  })

  var idFieldCounter = 0

  const close = clients[0]
    .query('user', id)
    .filter('x', '>', 5)
    .include('name')
    .subscribe((d) => {
      idFieldCounter++
    })

  await wait(10)
  clients[0].update('user', id, {
    x: 10,
  })

  await wait(10)
  clients[0].update('user', id, {
    x: 0,
  })

  await wait(80)

  equal(idFieldCounter, 3)

  close()
})

await test('partial update', async (t) => {
  const clientsN = 2
  const { clients } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        date: 'timestamp',
        x: 'uint8',
        name: 'string',
        gurk: 'string',
        flap: 'string',
        rurp: 'string',
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
    .include('x', 'gurk', 'rurp', 'flap')
    .subscribe((d) => {
      idFieldCounter++
    })

  const interval = setInterval(() => {
    // should be flagged as partial as well...
    clients[0].update('user', id, {
      date: { increment: 1000 },
    })
  }, 10)

  t.after(() => {
    clearInterval(interval)
  })

  await wait(10)
  clients[0].update('user', id, {
    x: 1,
  })

  await wait(10)
  clients[0].update('user', id, {
    x: 2,
  })

  await wait(80)

  equal(idCounter > 9, true)
  equal(idCounter < 15, true)

  equal(idFieldCounter, 3)

  clearInterval(interval)

  close()
})
