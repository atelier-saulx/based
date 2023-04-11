import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'
import { isClientContext } from '@based/functions'

test.serial('allow overwrite getIp', async (t) => {
  const coreClient = new BasedClient()

  const server = new BasedServer({
    port: 9910,
    getIp: () => {
      // this is so you can use custom headers or proxy protocol
      return 'xxx'
    },
    functions: {
      configs: {
        getIp: {
          type: 'function',
          maxPayloadSize: 1e8,
          fn: async (_, payload, ctx) => {
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
      return 'ws://localhost:9910'
    },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

  const ip = await coreClient.call('getIp')

  t.is(ip, 'xxx')
})
