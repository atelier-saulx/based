import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { isClientContext } from '@based/functions'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('allow overwrite getIp', async (t: T) => {
  const coreClient = new BasedClient()

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    getIp: () => {
      // this is so you can use custom headers or proxy protocol
      return 'xxx'
    },
    functions: {
      configs: {
        getIp: {
          type: 'function',
          maxPayloadSize: 1e8,
          fn: async (_, __, ctx) => {
            if (isClientContext(ctx)) {
              return ctx.session?.ip
            }
            return null
          },
        },
      },
    },
  })

  t.teardown(() => {
    server.destroy()
    coreClient.destroy()
  })

  await server.start()

  server.on('error', console.error)

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const ip = await coreClient.call('getIp')

  t.is(ip, 'xxx')
})
