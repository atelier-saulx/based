import test from 'ava'
import { BasedDbClient } from '../dist'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'

test.serial('Connection', async (t) => {
  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  let connectCnt = 0
  let reConnectCnt = 0
  let disconnect = 0

  await wait(500)

  const client = new BasedDbClient()

  client.on('connect', () => {
    connectCnt++
  })

  client.on('disconnect', () => {
    disconnect++
  })

  client.on('reconnect', () => {
    reConnectCnt++
  })

  client.connect({ port: 8081, host: '127.0.0.1' })

  await wait(500)

  client.disconnect()

  await wait(500)

  client.connect({ port: 8081, host: '127.0.0.1' })

  await wait(500)

  await server.destroy()

  await wait(500)

  const server2 = await startOrigin({
    port: 8081,
    name: 'default',
  })

  await wait(500)

  t.is(reConnectCnt, 1)
  t.is(connectCnt, 3)
  t.is(disconnect, 2)

  client.destroy()

  await server2.destroy()
})
