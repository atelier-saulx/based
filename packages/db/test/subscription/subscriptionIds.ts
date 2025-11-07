import { wait } from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/hooks.js'

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

// make a tool to test subs
await test('subscriptionIds', async (t) => {
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
        email: 'alias', // handle alias (from the other side...)
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

  const close = clients[0]
    .query('user', id)
    .filter('date', '<', 'now - 2s')
    .subscribe((d) => {
      console.log('single ID', d)
    })

  await wait(2100)

  console.log(
    'after 1s tick run Q:',
    await clients[0].query('user', id).filter('date', '<', 'now - 2s').get(),
  )

  close()
  // close2()
})

// multi query?
// clients[0]
//  .query('user', id).include('creditcard')
//  .query('payment', flappayment).filter('cards', '=', 1)
//  .query('derp', derpid)
//  .subscribe()
