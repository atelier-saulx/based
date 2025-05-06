import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('observablesDiff', async (t: T) => {
  const coreClient = new BasedClient()

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: async (_, __, update) => {
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
              largeThing.bla[
                ~~(Math.random() * largeThing.bla.length - 1)
              ].snup = ~~(Math.random() * 19999)
              // diff is made on an extra cache layer
              update(largeThing)
            }, 1)
            return () => {
              clearInterval(counter)
            }
          },
        },
      },
    },
  })
  await server.start()

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
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
      return t.context.ws
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
