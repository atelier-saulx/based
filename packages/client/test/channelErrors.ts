import test from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'

test.serial('Channel does not exist', async (t) => {
  const server = new BasedServer({ port: 9910 })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })

  client.on('debug', (x) => {
    console.log(x)
  })

  client.channel('bla').subscribe(() => {
    console.log('bla')
  })

  await wait(500)
  t.true(true)

  client.disconnect()
  await server.destroy()
})
