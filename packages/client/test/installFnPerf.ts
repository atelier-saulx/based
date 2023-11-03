import test from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'

test.serial('install fn perf', async (t) => {
  const client = new BasedClient()
  let cnt = 0
  const server = new BasedServer({
    port: 9910,
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
      return 'ws://localhost:9910'
    },
  })
  const time = await client.call('hello')
  t.is(cnt, 100000)
  t.true(time < 1e3)
})
