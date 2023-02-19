import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'

test.serial('channel', async (t) => {
  const server = await createSimpleServer({
    idleTimeout: 1e3,
    port: 9910,
  })
  const client = new BasedClient()
  client.connect({
    url: async () => 'ws://localhost:9910',
  })

  t.true(true)
  client.disconnect()
  await server.destroy()
})
