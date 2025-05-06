import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { wait } from '@saulx/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('Uninstall hook', async (t: T) => {
  let uninstallHookFired = false
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        bla: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            return 'x'
          },
        },
      },
      uninstall: async () => {
        uninstallHookFired = true
        return true
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => t.context.ws,
  })
  const x = await client.call('bla')
  t.is(x, 'x')
  await wait(6e3)
  t.true(uninstallHookFired)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})

test('uninstalled function is no longer callable', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        bla: {
          type: 'function',
          uninstallAfterIdleTime: 1,
          fn: async () => {
            return 'x'
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => t.context.ws,
  })
  const x = await client.call('bla')
  t.is(x, 'x')

  t.assert(Object.keys(server.functions.routes).includes('bla'))

  await server.functions.removeRoute('bla')
  await wait(200)

  await t.throwsAsync(client.call('bla'))

  client.disconnect()
  await server.destroy()
})
