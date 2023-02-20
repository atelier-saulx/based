import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'

test.serial('Subscribe channel', async (t) => {
  let closeCalled = false
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    channels: {
      mychannel: (based, payload, id, update) => {
        let cnt = 0
        const interval = setInterval(() => {
          update(++cnt)
        }, 100)
        return () => {
          closeCalled = true
          clearInterval(interval)
        }
      },
    },
  })
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const numbers: any[] = []
  const closeChannel = client
    .channel('mychannel', { bla: true })
    .subscribe((msg) => {
      numbers.push(msg)
    })

  await wait(500)
  t.true(numbers.length > 2)
  closeChannel()
  await wait(1100)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  t.true(closeCalled)
  client.disconnect()
  await server.destroy()
})

test.serial('Channel publish + subscribe', async (t) => {
  let closeCalled = false

  const listeners: Map<number, (msg: any) => void> = new Map()

  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    channels: {
      a: {
        publish: (based, payload, msg, id) => {
          listeners.get(id)?.(msg)
        },
        function: (based, payload, id, update) => {
          listeners.set(id, update)
          return () => {
            closeCalled = true
          }
        },
      },
    },
  })
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const r: any[] = []
  const closeChannel = client.channel('a', { bla: true }).subscribe((msg) => {
    r.push(msg)
  })
  await wait(100)
  client.channel('a', { bla: true }).publish(1)
  client.channel('a', { bla: true }).publish(2)
  client.channel('a', { bla: true }).publish(3)
  await wait(500)
  t.deepEqual(r, ['1', '2', '3'])
  closeChannel()
  await wait(1100)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  t.true(closeCalled)
  client.disconnect()
  await server.destroy()
})

test.serial.only('Channel publish no subscribe', async (t) => {
  const r: any[] = []

  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    channels: {
      a: {
        closeAfterIdleTime: 10,
        // based, payload, msg, ctx, id
        publish: (based, payload, msg) => {
          r.push(msg)
        },
        // add id as arg
        function: () => {
          return () => {}
        },
      },
    },
  })
  const client = new BasedClient()
  client.channelCleanupCycle = 100
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })
  client.channel('a', { bla: true }).publish(1)
  client.channel('a', { bla: true }).publish(2)
  client.channel('a', { bla: true }).publish(3)
  await wait(100)
  client.channel('a', { bla: true }).publish(4)
  await wait(500)
  t.deepEqual(r, [1, 2, 3, 4])
  t.is(client.channelState.size, 0)
  await wait(500)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})

// update channel function (reinstall active)

// timer

// disconnect / reconnect re create channel
