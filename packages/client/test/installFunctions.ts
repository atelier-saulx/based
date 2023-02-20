import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'

test.serial('Uninstall hook', async (t) => {
  let uninstallHookFired = false
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    functions: {
      bla: {
        uninstall: async () => {
          uninstallHookFired = true
        },
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
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })
  client.channel('a', { bla: true }).publish(1)
  client.channel('a', { bla: true }).publish(2)
  client.channel('a', { bla: true }).publish(3)
  await wait(500)
  console.info(r)
  t.deepEqual(r, ['1', '2', '3'])
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})

// update channel function (reinstall active)

// timer

// disconnect / reconnect re create channel
