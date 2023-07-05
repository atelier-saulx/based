import test from 'ava'
import { BasedDbClient } from '../dist'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'

test.serial('create connection', async (t) => {
  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  console.info('HELLO server started>? LD')

  await wait(1e3)
  console.info('HELLO HELLO')

  const client = new BasedDbClient()

  client.on('connect', () => {
    console.info('CONNECT TIME!')
  })

  client.on('disconnect', () => {
    console.info('DISCONNECT  TIME!')
  })

  client.on('reconnect', () => {
    console.info('reconnect  TIME!')
  })

  client.connect({ port: 8081, host: '127.0.0.1' })

  console.info('CONNECT')

  await wait(1e3)

  client.disconnect()

  await wait(1e3)

  client.connect({ port: 8081, host: '127.0.0.1' })

  await wait(1e3)

  await server.destroy()

  await wait(1e3)

  const server2 = await startOrigin({
    port: 8081,
    name: 'default',
  })

  await wait(3e3)

  t.true(true)
})
