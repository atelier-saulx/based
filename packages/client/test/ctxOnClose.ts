import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import getPort from 'get-port'
import { isClientContext } from '@based/functions'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('ctx on close', async (t: T) => {
  const client = new BasedClient()

  let cnt = 0

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        derp: {
          type: 'function',
          fn: async (based, payload, ctx) => {
            if (isClientContext(ctx) && !ctx.session.state?.handled) {
              ctx.session.state = {}
              ctx.session.state.handled = true
              ctx.session.onClose = () => {
                cnt++
              }
            }
            return 'bla'
          },
          uninstallAfterIdleTime: 1e3,
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

  client.once('connect', (isConnected) => {})

  const bla = await client.call('derp')

  t.is(bla, 'bla')

  await client.destroy()
  await wait(100)
  t.is(cnt, 1)

  t.is(await (await fetch(t.context.http + '/derp')).text(), 'bla')

  t.is(cnt, 2)

  await server.destroy()
})
