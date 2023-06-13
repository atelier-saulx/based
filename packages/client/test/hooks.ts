import test from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'

test.serial('Channel hook', async (t) => {
  let subCnt = 0
  let unSubCnt = 0
  const server = new BasedServer({
    port: 9910,
    channel: {
      subscribe: (channel, ctx) => {
        subCnt++
      },
      unsubscribe: (channel, ctx) => {
        unSubCnt++
      },
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

  t.is(subCnt, 1)

  closeChannel()
  await wait(500)

  t.is(unSubCnt, 1)

  client.disconnect()
  await server.destroy()
})

test.serial('Query hook', async (t) => {
  let subCnt = 0
  let getCnt = 0
  let unSubCnt = 0
  const server = new BasedServer({
    port: 9910,
    query: {
      subscribe: () => {
        subCnt++
      },
      unsubscribe: () => {
        unSubCnt++
      },
      get: () => {
        getCnt++
      },
    },
    functions: {
      configs: {
        myobs: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            update('fun')
            return () => {}
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
  const close = client.query('myobs', { bla: true }).subscribe((msg) => {})

  await wait(500)

  t.is(subCnt, 1)

  close()
  await wait(500)

  t.is(unSubCnt, 1)

  await client.query('myobs').get()

  t.is(getCnt, 1)

  await (await fetch('http://localhost:9910/myobs')).text()

  t.is(getCnt, 2)

  client.disconnect()
  await server.destroy()
})
