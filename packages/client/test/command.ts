import test from 'ava'
import { BasedDbClient } from '../dist'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'

test.serial('Command', async (t) => {
  const TIME = 2500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  client.command('flap', {
    surp: true,
  })

  // console.log(x)

  await wait(TIME)

  client.destroy()
  await server.destroy()

  t.true(true)
})
