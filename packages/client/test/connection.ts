import test from 'ava'
import { BasedDbClient } from '../dist'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'

test.serial('Connection', async (t) => {
  const TIME = 500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  let connectCnt = 0
  let reConnectCnt = 0
  let disconnect = 0

  await wait(TIME)

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

  await wait(TIME)

  client.disconnect()

  await wait(TIME)

  client.connect({ port: 8081, host: '127.0.0.1' })

  await wait(TIME)

  await server.destroy()

  await wait(TIME)

  const server2 = await startOrigin({
    port: 8081,
    name: 'default',
  })

  await wait(TIME * 2)

  t.is(reConnectCnt, 1)
  t.is(connectCnt, 3)
  t.is(disconnect, 2)

  client.destroy()

  await server2.destroy()
})
