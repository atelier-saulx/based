import test from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'
import { channel } from 'diagnostics_channel'

test.serial('Channel hook', async (t) => {
  let closeCalled = false
  const server = new BasedServer({
    port: 9910,
    channel: {
      subscribe: (channel, ctx) => {},
      unsubscribe: (channel, ctx) => {},
    },
    functions: {
      configs: {
        mychannel: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          subscriber: (_, __, ___, update) => {
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
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const closeChannel = client
    .channel('mychannel', { bla: true })
    .subscribe((msg) => {})

  await wait(500)

  closeChannel()
  await wait(4e3)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  t.true(closeCalled)
  client.disconnect()
  await server.destroy()
})

// test.serial('Query hook', async (t) => {
//   let closeCalled = false
//   const listeners: Map<number, (msg: any) => void> = new Map()
//   const server = new BasedServer({
//     port: 9910,
//     functions: {
//       closeAfterIdleTime: {
//         channel: 0,
//         query: 0,
//       },
//       configs: {
//         a: {
//           type: 'channel',
//           uninstallAfterIdleTime: 1e3,
//           publisher: (_, __, msg, id) => {
//             listeners.get(id)?.(msg)
//           },
//           subscriber: (_, __, id, update) => {
//             listeners.set(id, update)
//             return () => {
//               closeCalled = true
//             }
//           },
//         },
//       },
//     },
//   })
//   await server.start()
//   const client = new BasedClient()
//   await client.connect({
//     url: async () => 'ws://localhost:9910',
//   })
//   const r: any[] = []
//   const closeChannel = client.channel('a', { bla: true }).subscribe((msg) => {
//     r.push(msg)
//   })
//   await wait(100)
//   client.channel('a', { bla: true }).publish(1)
//   client.channel('a', { bla: true }).publish(2)
//   client.channel('a', { bla: true }).publish(3)
//   await wait(500)
//   t.deepEqual(r, [1, 2, 3])
//   closeChannel()
//   await wait(1500)
//   t.is(Object.keys(server.activeChannels).length, 0)
//   t.is(server.activeChannelsById.size, 0)
//   t.true(closeCalled)
//   client.disconnect()
//   await server.destroy()
// })
