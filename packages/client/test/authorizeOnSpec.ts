import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('Specific authorize on spec', async (t: T) => {
  let authCalled = 0
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    rateLimit: {
      ws: 1e9,
      drain: 1e3,
      http: 1e3,
    },
    functions: {
      closeAfterIdleTime: { channel: 10, query: 10 },
      configs: {
        snax: {
          type: 'stream',
          uninstallAfterIdleTime: 1e3,
          authorize: async () => {
            authCalled++
            return true
          },
          fn: async () => {
            return 'bla'
          },
        },
        slax: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          authorize: async () => {
            authCalled++
            return true
          },
          fn: (_, __, update) => {
            update('slax')
            return () => {}
          },
        },
        klax: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          authorize: async () => {
            authCalled++
            return true
          },
          publisher: () => {},
          subscriber: (_, __, ___, update) => {
            update('slax')
            return () => {}
          },
        },
        bla: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async () => 'x',
        },
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          authorize: async () => {
            authCalled++
            return true
          },
          fn: async () => {
            return 'hello'
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient({
    url: t.context.ws,
  })

  await client.call('hello', 'snurp')

  await client.call('bla')

  t.is(authCalled, 1)

  await client.query('slax').get()

  t.is(authCalled, 2)
  client.channel('klax').subscribe(() => {})

  await wait(100)
  t.is(authCalled, 3)
  client.channel('klax').publish(1)
  await wait(100)
  t.is(authCalled, 4)

  await client.stream('snax', {
    contents: Buffer.from(JSON.stringify({ bla: true }), 'base64'),
  })

  await wait(1e3)

  t.is(authCalled, 5)

  t.teardown(async () => {
    await client.destroy()
    await server.destroy()
  })
})
