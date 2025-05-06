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
  const client2 = new BasedClient()

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
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
  let cnt = 0

  client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  client2.connect({
    url: async () => {
      return t.context.ws
    },
  })

  client2.on('connect', (isConnected) => {
    cnt++
  })

  client.on('connect', (isConnected) => {
    cnt++
  })

  await wait(1000)

  server.forceReload()

  await wait(500)

  t.is(cnt, 4)

  await wait(2000)

  t.true(true)

  await client2.destroy()
  await server.destroy()
  await client.destroy()
})
