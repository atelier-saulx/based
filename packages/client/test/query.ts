import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('query functions', async (t) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: 9910,
    functions: {
      configs: {
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            let cnt = 0
            update(cnt)
            const counter = setInterval(() => {
              update(++cnt)
            }, 1000)
            return () => {
              clearInterval(counter)
            }
          },
        },
      },
    },
  })
  await server.start()

  client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })
  client.once('connect', (isConnected) => {
    console.info('   connect', isConnected)
  })
  const obs1Results: any[] = []
  const obs2Results: any[] = []

  const close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      obs1Results.push(d)
    })

  const close2 = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      obs2Results.push(d)
    })

  await wait(500)
  close()
  server.functions.updateInternal({
    type: 'query',
    name: 'counter',
    version: 2,
    uninstallAfterIdleTime: 1e3,
    maxPayloadSize: 1e9,
    rateLimitTokens: 1,
    fn: (_, __, update) => {
      let cnt = 0
      const counter = setInterval(() => {
        update('counter2:' + ++cnt)
      }, 100)
      return () => {
        clearInterval(counter)
      }
    },
  })
  await wait(1e3)
  close2()
  t.true(obs1Results.length < obs2Results.length)
  t.true(obs2Results[obs2Results.length - 1].startsWith('counter2:'))
  await wait(100)
  t.is(Object.keys(server.activeObservables).length, 1)
  t.is(server.activeObservablesById.size, 1)
  await wait(5000)
  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)
  await wait(6e3)
  t.is(Object.keys(server.functions.specs).length, 0)
})
