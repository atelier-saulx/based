import test, { ExecutionContext } from 'ava'
import { wait } from '@based/utils'
import getPort from 'get-port'
import { BasedClient } from '../../src/client/index.js'
import { BasedServer } from '../../src/server/server.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('null', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        nullFn: {
          type: 'function',
          fn: async () => {
            return null
          },
        },
        null: {
          type: 'query',
          fn: (_, __, update) => {
            let cnt = 0

            const counter = setInterval(() => {
              const v = cnt % 2 ? { mrx: true } : null
              cnt++
              update(v)
            }, 500)
            return () => {
              clearInterval(counter)
            }
          },
        },
        nestedNull: {
          type: 'query',
          fn: (b, __, update) => {
            return b.query('null').subscribe(update)
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

  const val = await client.query('null').get()
  t.deepEqual(val, null)

  const x = await client.call('nullFn')
  t.deepEqual(x, null)

  const val2 = await client.query('nestedNull').get()
  t.deepEqual(val2, null)

  const obs: any[] = []

  const close = client.query('null').subscribe((v) => {
    obs.push(v)
  })

  await wait(501)

  t.deepEqual(obs, [null, { mrx: true }])

  close()
})
