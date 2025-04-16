import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { isClientContext, isWsContext } from '@based/functions'
import getPort from 'get-port'
import pkg from '../package.json' with { type: 'json' }
type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('pass version in connection header', async (t: T) => {
  const client = new BasedClient({ url: t.context.ws })
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: {
        getVersion: {
          type: 'function',
          maxPayloadSize: 1e8,
          fn: async (_, __, ctx) => {
            if (isWsContext(ctx)) {
              return ctx.session.version
            }
            return null
          },
        },
      },
    },
  })

  t.teardown(() => {
    server.destroy()
    client.destroy()
  })

  await server.start()
  const version = await client.call('getVersion')

  t.is(version, pkg.version)
})
