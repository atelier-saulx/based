import test, { ExecutionContext } from 'ava'
import getPort from 'get-port'
import { BasedServer } from '../../src/server/server.js'
import { BasedClient } from '../../src/client/index.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('connect', async (t: T) => {
  const port2 = await getPort()
  const serverA = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: {
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (_, payload) => {
            if (payload) {
              return payload.length
            }
            return 'flap'
          },
        },
      },
    },
  })
  await serverA.start()

  const serverB = new BasedServer({
    silent: true,
    port: port2,
    functions: {
      configs: {
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (_, payload) => {
            if (payload) {
              return payload.length
            }
            return 'flip'
          },
        },
      },
    },
  })
  await serverB.start()

  const client = new BasedClient()

  await client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  t.is(await client.call('hello'), 'flap')

  await client.connect({
    url: async () => {
      return 'ws://localhost:' + port2
    },
  })

  t.is(await client.call('hello'), 'flip')

  await serverA.destroy()
  await serverB.destroy()
})
