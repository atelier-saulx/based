import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src/index'

test.serial('addSpecs', async (t) => {
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    queryFunctions: {
      bla: {
        function: (based, payload, update) => {
          update('?')
          return () => {}
        },
      },
    },
    functions: {
      bye: {
        function: async () => {
          return 'flap'
        },
      },
    },
  })

  const client = new BasedClient({
    url: 'ws://localhost:9910',
  })

  server.functions.addSpecs({
    hello: {
      name: 'hello',
      function: async () => 'x',
      checksum: 1,
    },
  })

  t.is(await client.call('hello'), 'x')
  t.is(await client.call('bye'), 'flap')

  await server.destroy()

  t.true(true)
})
