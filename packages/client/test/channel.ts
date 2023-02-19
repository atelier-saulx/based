import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'

test.serial('Subscribe channel', async (t) => {
  const server = await createSimpleServer({
    idleTimeout: 1e3,
    port: 9910,
  })
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })

  const closeChannel = client
    .channel('mychannel', { bla: true })
    .subscribe((msg) => {
      console.info(msg)
    })

  await wait(2e3)

  closeChannel()
  t.true(true)
  client.disconnect()
  await server.destroy()
})
