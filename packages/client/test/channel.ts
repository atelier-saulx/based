import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'

test.serial('Subscribe channel', async (t) => {
  const server = await createSimpleServer({
    idleTimeout: 1e3,
    port: 9910,
    channels: {
      mychannel: (based, payload, update) => {
        console.info('start channel', based, payload)
        let cnt = 0
        const interval = setInterval(() => {
          update(++cnt)
        }, 100)
        return () => {
          console.info('CLOSE')
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
  t.true(true)
  client.disconnect()
  await server.destroy()
})

/*
 xx: {
        publish: (msg) => {
          console.info('publish', msg)
        },
        function: () => {
          return () => {
            
          }
        },
      },
*/
