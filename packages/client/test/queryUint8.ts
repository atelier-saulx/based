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
  const clientOld = new BasedClientOld()

  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: {
        derpi: {
          type: 'function',
          fn: async () => {
            return 'STRING FOR BOYS'
          },
        },
        derpiJson: {
          type: 'function',
          fn: async () => {
            return { x: 1, y: 2 }
          },
        },
        derpiBuffer: {
          type: 'function',
          fn: async () => {
            const x = new Uint8Array(10)
            x.fill(66, 0)
            return x
          },
        },
        flap: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            const x = {
              derp: 66,
            }
            // 0 json
            // 1 string (simpler optmizes strings)
            update(x)
            // cache stuff , no compress etc etc
            const counter = setInterval(() => {
              x.derp++
              update(x)
            }, 10)
            return () => {
              clearInterval(counter)
            }
          },
        },
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            var cnt = 1
            const x = new Uint8Array(1)
            x[0] = 66
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

  clientOld.connect({
    url: async () => {
      return t.context.ws
    },
  })

  client.once('connect', (isConnected) => {
    console.info('   connect', isConnected)
  })

  const obs1Results: any[] = []

  const close = client
    .query('flap', {
      myQuery: 123,
    })
    .subscribe((d) => {
      console.log('NEW', d)
      obs1Results.push(d)
    })

  const close2 = clientOld
    .query('flap', {
      myQuery: 123,
    })
    .subscribe((d) => {
      console.log('OLD', d)
      obs1Results.push(d)
    })

  const close3 = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      console.log('NEW BUFFER FORMAT!', d)
      obs1Results.push(d)
    })

  await wait(100)
  close()
  close2()
  close3()

  console.log('--------------------------------')

  // console.log('NEW', await client.call('derpi'))
  // console.log('OLD', await clientOld.call('derpi'))

  await wait(1000)

  t.pass()
})
