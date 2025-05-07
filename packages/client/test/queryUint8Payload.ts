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

test('query uint8Array args', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        counter: {
          type: 'query',
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

  const obs1Results: any[] = []
  const obs2Results: any[] = []

  const flap = new Uint8Array(200)
  const flap2 = new Uint8Array(200)

  flap2[100] = 1

  const close = client.query('counter', flap).subscribe((d) => {
    obs1Results.push(d)
  })

  const close2 = client.query('counter', flap2).subscribe((d) => {
    obs1Results.push(d)
  })

  await wait(1e3)

  t.deepEqual(
    [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9],
    obs1Results,
  )

  close()
  close2()
  await server.destroy()
  await client.destroy()
})
