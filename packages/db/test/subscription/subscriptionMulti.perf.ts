import { wait } from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/hooks.js'
import { clearInterval } from 'node:timers'

const start = async (t, clientsN = 2, subTime = 100) => {
  const server = new DbServer({
    path: t.tmp,
  })
  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: getDefaultHooks(server, subTime),
      }),
  )
  await server.start({ clean: true })
  t.after(() => server.destroy())
  return { clients, server }
}

await test('subscriptionMulti', async (t) => {
  const clientsN = 2
  const { clients } = await start(t, clientsN, 10)

  await clients[0].setSchema({
    types: {
      user: {
        derp: 'uint32',
        name: 'string',
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    clients[1].create('user', {
      derp: i,
      name: 'mr ' + i,
    })
  }

  await clients[1].drain()

  const close2 = clients[1]
    .query('user')
    .filter('derp', '>', 1e6 - 10)
    .subscribe((q) => {
      console.log(q)
    })

  // in this case we want to optimize for FILTER so don re-fire for all

  // if total amount of results is 20% of total it will re-run the qeury on type change (can be changed)
  // or just go on range if > 10.000 or something

  // this thing will be filled from the query itself
  const multiSub = {
    // start, operator, value
    // have to make sure OR etc is handled correctly - we start with simple queries
    filterMainFields: [0, 6, 1e6 - 10],
    // if fragmentation is low this will not be there
    hasIdBitSet: true, // very simple to check max - min > range * 10 ?
    includedIds: [], // this can be a bitset potentialy scince we know the limit
    //  - does require a reshuffle everytime the min changes but that should be fast if the amounts are reasonable
    // if the range is very large it will not do anything
    // maxId:
    // minId:
    // offset: 0,
    // limit: 100,
    // fields: []simd array

    // can also be included FIELDS thats a bit more special but this is good when it uses sort indexes
    // then we can check very efficiently if something is in the included ids
    // we will have subs ids that a specific worker is responsible for
    // current included ids
  }

  // query will have an extra thing SUBID
  // sub id will pass the ids to it

  let interval = setInterval(() => {
    const x = 1e6 - 100
    clients[1].update('user', Math.random() * x + 1, {
      derp: x,
    })
    // update but never fire the sub
  }, 10)
  t.after(() => {
    clearInterval(interval)
  })

  await wait(1000)
})
