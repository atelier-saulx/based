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

test('send and receive typedarrays', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: {
        queryBuf: {
          type: 'query',
          closeAfterIdleTime: 0,
          uninstallAfterIdleTime: -1,
          fn: (_, payload, update) => {
            console.log('query payload', payload)
            update(payload)
            return () => {}
          },
        },
        functionBuf: {
          type: 'function',
          uninstallAfterIdleTime: -1,
          fn: async (based, payload) => {
            console.log('function payload', payload)
            return payload
          },
        },
      },
    },
  })
  const client = new BasedClient({
    url: t.context.ws,
  })

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  await server.start()

  const u8 = Uint8Array.from([1, 2, 3, 4])
  const q = await client.query('queryBuf', u8).get()

  t.deepEqual(u8, q)

  const f = await client.call('functionBuf', u8)

  t.deepEqual(u8, f)
})
