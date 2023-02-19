import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'

test.serial('Subscribe channel', async (t) => {
  let closeCalled = false
  const server = await createSimpleServer({
    idleTimeout: 1e3,
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

test.serial('Channel publish', async (t) => {
  let closeCalled = false

  const listeners: Map<number, (msg: any) => void> = new Map()

  const server = await createSimpleServer({
    idleTimeout: 1e3,
    port: 9910,
    channels: {
      a: {
        // better api.. update
        // based, payload, msg, ctx, id
        publish: (based, payload, msg, id) => {
          listeners.get(id)?.(msg)
        },
        // add id as arg
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

  console.info(r)

  t.true(r.length > 2)
  closeChannel()
  await wait(1100)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  t.true(closeCalled)
  client.disconnect()
  await server.destroy()
})

/*
 
*/
