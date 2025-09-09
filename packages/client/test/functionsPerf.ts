import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('functions perf', async (t: T) => {
  const client = new BasedClient()
  let resolve: any

  const amount = 1e5
  // add worker
  let cnt = 0
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    auth: {
      authorize: async () => {
        return true
      },
    },
    functions: {
      configs: {
        hello: {
          // public: true,
          type: 'function',
          rateLimitTokens: 0,
          maxPayloadSize: 1e8,
          fn: async (_, payload) => {
            cnt++
            if (cnt === amount) {
              resolve()
            }
            return new Uint8Array([])
          },
          uninstallAfterIdleTime: 1e3,
        },
      },
    },
  })
  await server.start()

  server.on('error', console.error)

  client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const p = new Promise((r) => {
    resolve = r
  })
  let i = amount
  let d = Date.now()
  while (i) {
    client.call('hello')
    i--
  }

  await p
  console.log(amount, 'took', Date.now() - d, 'ms')
  await wait(100 + amount * 0.005)

  t.true(true)

  await client.destroy()
  await server.destroy()
})
