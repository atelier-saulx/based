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

  // single REF
  // multi REFERENCES
  // EDGE + REFERENS (2 types)

  await clients[0].setSchema({
    types: {
      user: {
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
      },
    },
  })

  const id = await clients[0].create('user', { name: 'mr poop' })

  const close = clients[1]
    .query('user', id)
    .include('name')
    .subscribe((d) => {
      console.log('SINGLE ID', d)
    })

  const close2 = clients[0]
    .query('user')
    .include('name')
    .subscribe((d) => {
      console.log('MULTI ID', d)
    })

  await clients[0].update('user', 1, {
    name: 'MR FLAP!',
  })

  await wait(10)
  console.log('Single update 2')

  await clients[1].update('user', 1, {
    name: 'MR FLAP!222',
  })

  await wait(1000)
  close()
  close2()
})
