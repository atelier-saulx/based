import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('Specific authorize on spec', async (t) => {
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    closeAfterIdleTime: { channel: 10, query: 10 },
    port: 9910,
    rateLimit: {
      ws: 1e9,
      drain: 1e3,
      http: 0,
    },
    functions: {
      hello: {
        authorize: async () => {
          console.info('LULLLZORS')
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

  client.call('hello', 'snurp')

  await server.destroy()
})
