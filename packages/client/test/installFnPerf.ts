import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('install fn perf', async (t: T) => {
  const client = new BasedClient()
  let cnt = 0
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: {
        hello2: {
          type: 'function',
          maxPayloadSize: 1e8,
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            cnt++
            return 'flap'
          },
        },
        hello: {
          type: 'function',
          public: true,
          maxPayloadSize: 1e8,
          uninstallAfterIdleTime: 1e3,
          fn: async (based) => {
            const d = Date.now()
            const q = []
            for (let i = 0; i < 1e5; i++) {
              // @ts-ignore
              q.push(based.call('hello2'))
            }
            await Promise.all(q)
            return Date.now() - d
          },
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
  const time = await client.call('hello')
  t.is(cnt, 100000)
  t.true(time < 1e3)
})
