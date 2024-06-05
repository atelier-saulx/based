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

test('reload protocol', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    auth: {
      authorize: async () => true,
    },
    functions: {
      configs: {
        counter: {
          type: 'query',
          throttle: 1000,
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            let cnt = 0
            update(cnt)
            const counter = setInterval(() => {
              update(++cnt)
            }, 100)
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
      return t.context.ws
    },
  })

  client.once('connect', (isConnected) => {
    console.info('   connect', isConnected)
  })
  const obs1Results: any[] = []

  const close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      obs1Results.push(d)
    })

  await wait(2000)

  t.is(obs1Results.length, 3)

  close()

  await wait(2000)

  await server.destroy()
  await client.destroy()
})
