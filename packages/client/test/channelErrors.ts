import test from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { wait } from '@saulx/utils'

test.serial('Channel does not exist', async (t) => {
  const server = new BasedServer({ port: 9910 })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })
  let errCnt = 0
  client.channel('bla').subscribe(
    () => {},
    () => {
      errCnt++
    }
  )
  await wait(500)
  t.is(errCnt, 1)
  client.disconnect()
  await server.destroy()
})
