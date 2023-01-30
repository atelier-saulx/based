import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'

test.serial('nested functions internal only', async (t) => {
  const client = new BasedClient()
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      helloInternal: {
        internalOnly: true,
        function: async () => {
          return 'internal'
        },
      },
      hello: async (based, payload, ctx) => {
        return based.call('helloInternal', payload, ctx)
      },
    },
  })
  await client.connect({
    url: 'ws://localhost:9910',
  })
  t.is(await client.call('hello'), 'internal')
  await t.throwsAsync(client.call('snuix'))
  await t.throwsAsync(client.call('helloInternal'))
  await server.destroy()
})
