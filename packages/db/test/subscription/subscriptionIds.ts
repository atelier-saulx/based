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

  // const close = clients[1]
  //   .query('user', id)
  //   .include('name', 'friend.name')
  //   .subscribe((d) => {
  //     console.log('SINGLE ID', d)
  //   })

  // const close2 = clients[0]
  //   .query('user')
  //   .include('name')
  //   .filter('date', '<', 'now - 1s')
  //   // has to be handled very different - store index of the timestamp (to updated when re - exec the query)

  //   // add support for this
  //   // .filter('control.boys[0].name', '=', 'mr durk')

  //   // .filter('control.flap.name', '=', 'mr durk')
  //   .subscribe((d) => {
  //     console.log('MULTI ID', d)
  //   })

  // const close2 = clients[0]
  //   .query('control')
  //   .include('location')
  //   .filter('flap.date', '<', 'now - 1s')
  //   .subscribe((d) => {
  //     console.log('MULTI ID', d)
  //   })

  const close = clients[0]
    .query('user', id)
    .filter('date', '<', 'now - 1s')
    .subscribe((d) => {
      console.log('single ID', d)
    })

  // moves up

  // await clients[0].update('user', 1, {
  //   name: 'MR FLAP!',
  // })

  // await wait(10)
  // console.log('Single update 2')

  // await clients[1].update('user', 1, {
  //   name: 'MR FLAP!222',
  // })

  console.log('CREATE DURK')
  const durk = await clients[0].create('user', {
    name: 'mr durk',
    friend: id,
    date: 'now',
  })

  const control = clients[0].create('control', {
    location: 'Controled',
    boys: [durk],
    flap: durk,
  })

  // now

  // clients[0].update('user', durk, {
  //   control,
  // })

  // --> add filter in sub

  console.log('set dat control!')

  await wait(1100)

  console.log(
    'after tick',
    await clients[0].query('user', id).filter('date', '<', 'now - 1s').get(),
  )

  // single sub ID + NOW
  // handle refs + NOW

  // alias as a system
  // ADD STATIC to schema

  // extra function find NEXT time to start

  close()
  // close2()
})

// multi query?
// clients[0]
//  .query('user', id).include('creditcard')
//  .query('payment', flappayment).filter('cards', '=', 1)
//  .query('derp', derpid)
//  .subscribe()
