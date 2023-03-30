import test from 'ava'
import { BasedClient } from '../src/index'
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
      uninstallAfterIdleTime: 1e3,
      closeAfterIdleTime: { channel: 10, query: 10 },
      specs: {
        snax: {
          name: 'snax',
          stream: true,
          authorize: async () => {
            authCalled++
            return true
          },
          function: async () => {
            return 'bla'
          },
        },
        slax: {
          query: true,
          authorize: async () => {
            authCalled++
            return true
          },
          function: (_, __, update) => {
            update('slax')
            return () => {}
          },
        },
        klax: {
          channel: true,
          authorize: async () => {
            authCalled++
            return true
          },
          publish: () => {},
          function: (_, __, ___, update) => {
            update('slax')
            return () => {}
          },
        },
        bla: {
          function: async () => 'x',
        },
        hello: {
          authorize: async () => {
            authCalled++
            return true
          },
          function: async () => {
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
