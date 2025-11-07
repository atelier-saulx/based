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

await test('subscriptionNow', async (t) => {
  const clientsN = 2
  const { clients } = await start(t, clientsN)

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
    name: 'mr poop',
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
})
