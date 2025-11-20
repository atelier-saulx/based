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
        hooks: getDefaultHooks(server, 100),
      }),
  )
  await server.start({ clean: true })
  t.after(() => server.destroy())
  return { clients, server }
}

await test('simple', async (t) => {
  const clientsN = 2
  const { clients, server } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        friend: {
          ref: 'user',
          prop: 'friend',
        },
        control: {
          ref: 'control',
          prop: 'boys',
        },
        date: 'timestamp',
        x: 'uint8',
        derp: 'uint32',
        location: 'string',
        lang: 'string',
        name: 'string',
        email: 'alias',
      },
      control: {
        x: 'uint8',
        derp: 'uint32',
        location: 'string',
        lang: 'string',
        flap: {
          ref: 'user',
          prop: 'flapControl',
        },
      },
    },
  })

  const id = await clients[0].create('user', {
    name: 'mr flap',
    date: 'now',
  })

  var multiCounter = 0
  var idCounter = 0
  var totalLen = 0

  const close = clients[0]
    .query('user', id)
    .filter('date', '<', 'now - 2s')
    .subscribe((d) => {
      totalLen += d.length
      multiCounter++
    })

  const close2 = clients[0]
    .query('user')
    .filter('date', '<', 'now - 2s')
    .subscribe((d) => {
      totalLen += d.length
      idCounter++
    })

  await wait(3000)

  equal(multiCounter, 2)
  equal(idCounter, 2)
  equal(totalLen, 2)

  close()
  close2()

  equal(server.subscriptions.active, 0, 'Removed all active subs')
  equal(server.subscriptions.now.listeners.size, 0, 'Remove all now listeners')
})

await test('multiFilter', async (t) => {
  const clientsN = 2
  const { clients, server } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      edition: {},
      sequence: {
        edition: { ref: 'edition', prop: 'sequence' },
        startTime: 'timestamp',
      },
    },
  })

  const edition = await clients[0].create('edition', {})

  var total = 0

  const close = clients[0]
    .query('sequence')
    .locale('en')
    .filter('edition', '=', edition)
    .filter('startTime', '!=', 0)
    .filter('startTime', '<', 'now')
    .sort('startTime', 'desc')
    .subscribe((d) => {
      total += d.length
    })

  const sequence = await clients[0].create('sequence', {
    edition,
    startTime: 'now + 1y',
  })

  await wait(1000)

  await clients[0].update('sequence', sequence, {
    startTime: 'now + 1s',
  })

  await wait(3000)

  equal(total, 1)

  close()

  equal(server.subscriptions.active, 0, 'Removed all active subs')
  equal(server.subscriptions.now.listeners.size, 0, 'Remove all now listeners')
})
