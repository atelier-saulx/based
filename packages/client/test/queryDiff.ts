import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('observablesDiff', async (t) => {
  const coreClient = new BasedClient()

  const server = await createSimpleServer({
    port: 9910,
    queryFunctions: {
      counter: async (based, payload, update) => {
        const largeThing: { bla: any[] } = { bla: [] }
        for (let i = 0; i < 1e4; i++) {
          largeThing.bla.push({
            title: 'snurp',
            cnt: i,
            snurp: ~~(Math.random() * 19999),
          })
        }
        update(largeThing)
        const counter = setInterval(() => {
          largeThing.bla[~~(Math.random() * largeThing.bla.length - 1)].snup =
            ~~(Math.random() * 19999)
          // diff is made on an extra cache layer
          update(largeThing)
        }, 1)
        return () => {
          clearInterval(counter)
        }
      },
    },
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

  const results: any[] = []

  const close = coreClient
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      results.push(d)
    })

  await wait(3e3)

  coreClient.disconnect()

  await wait(3e3)

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await wait(1e3)

  coreClient.cache.clear()

  await wait(5e3)

  close()

  await wait(6e3)

  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)

  await wait(6e3)
  t.is(Object.keys(server.functions.specs).length, 0)
})
