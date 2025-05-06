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

test('query cache', async (t: T) => {
  const client = new BasedClient(undefined, {
    maxCacheSize: 11000,
  })

  const server = new BasedServer({
    port: t.context.port,
    rateLimit: { ws: 1e9, http: 1e9, drain: 1e3 },
    functions: {
      configs: {
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            const x: string[] = []
            for (let i = 0; i < 1000; i++) {
              x.push('flap ' + i)
            }
            update(x)
            return () => {}
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

  for (let i = 0; i < 1000; i++) {
    const close = client
      .query('counter', {
        myQuery: i,
      })
      .subscribe((d) => {
        obs1Results.push(d)
        close()
      })
  }

  await wait(1500)

  await wait(1000)

  const close = client
    .query('counter', {
      myQuery: 1212,
    })
    .subscribe((d) => {
      obs1Results.push(d)
    })

  await wait(1000)

  close()

  await wait(1000)

  t.true(client.cacheSize < 11000)

  await server.destroy()
  client.destroy()
})
