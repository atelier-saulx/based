import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('Specific authorize on spec', async (t) => {
  let authCalled = 0
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    closeAfterIdleTime: { channel: 10, query: 10 },
    port: 9910,
    rateLimit: {
      ws: 1e9,
      drain: 1e3,
      http: 1e3,
    },
    streams: {
      snax: {
        authorize: async () => {
          authCalled++
          return true
        },
        function: async () => {
          return 'bla'
        },
      },
    },
    queryFunctions: {
      slax: {
        authorize: async () => {
          authCalled++
          return true
        },
        function: (based, payload, update) => {
          update('slax')
          return () => {}
        },
      },
    },
    channels: {
      klax: {
        authorize: async () => {
          authCalled++
          return true
        },
        publish: () => {},
        function: (based, payload, id, update) => {
          update('slax')
          return () => {}
        },
      },
    },
    functions: {
      bla: async () => 'x',
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
  })
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
  t.is(1, 1)
  await server.destroy()
})
