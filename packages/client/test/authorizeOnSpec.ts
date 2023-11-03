import test from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('Specific authorize on spec', async (t) => {
  let authCalled = 0
  const server = new BasedServer({
    port: 9910,
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
    url: 'ws://localhost:9910',
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
  t.is(authCalled, 5)
  await wait(1e3)
  await server.destroy()
})
