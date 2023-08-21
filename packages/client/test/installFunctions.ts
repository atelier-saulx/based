import test from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'

test.serial('Uninstall hook', async (t) => {
  let uninstallHookFired = false
  const server = new BasedServer({
    port: 9910,
    functions: {
      configs: {
        bla: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            return 'x'
          },
        },
      },
      uninstall: async () => {
        uninstallHookFired = true
        return true
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const x = await client.call('bla')
  t.is(x, 'x')
  await wait(6e3)
  t.true(uninstallHookFired)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})

// TODO: is this even the expected behaviour?
// test.serial('uninstalled function is no longer callable', async (t) => {
//   const server = new BasedServer({
//     port: 9910,
//     functions: {
//       configs: {
//         bla: {
//           type: 'function',
//           uninstallAfterIdleTime: 1,
//           fn: async () => {
//             return 'x'
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
//   const x = await client.call('bla')
//   t.is(x, 'x')

//   t.assert(Object.keys(server.functions.routes).includes('bla'))

//   await server.functions.uninstall('bla')
//   await wait(200)

//   await t.throwsAsync(client.call('bla'))

//   client.disconnect()
//   await server.destroy()
// })
