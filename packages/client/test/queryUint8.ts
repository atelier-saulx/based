import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import getPort from 'get-port'
import { wait } from '@saulx/utils'
import { BasedClient as BasedClientOld } from '@based/client-old'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

// @based/client-old

test('query uint8', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: {
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            var cnt = 1
            const x = new Uint8Array(1)
            // 0 json
            // 1 string (simpler optmizes strings)
            update(x, cnt, false, undefined, undefined, 0, false)
            // cache stuff , no compress etc etc
            const counter = setInterval(() => {
              x[0] = x[0] + 1
              if (x[0] === 255) {
                x[0] = 0
              }
              cnt++
              update(x, cnt, false, undefined, undefined, 0, false)
            }, 10)
            return () => {
              clearInterval(counter)
            }
          },
        },
      },
    },
  })
  await server.start()

  // has to send the version in 1 byte
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
      console.log(d)
      obs1Results.push(d)
    })

  await wait(100)

  t.pass()
})
