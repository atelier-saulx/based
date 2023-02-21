import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('message incoming/outgoing', async (t) => {
  const client = new BasedClient()
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    channels: {
      a: {
        function: (based, payload, id, update) => {
          let cnt = 0
          update(cnt)
          const counter = setInterval(() => {
            update(++cnt)
          }, 100)
          return () => {
            clearInterval(counter)
          }
        },
      },
    },
    queryFunctions: {
      counter: (based, payload, update) => {
        let cnt = 0
        update(cnt)
        const counter = setInterval(() => {
          update(++cnt)
        }, 100)
        return () => {
          clearInterval(counter)
        }
      },
    },
  })

  let debugMessages = 0

  client.on('debug', () => {
    debugMessages++
  })

  client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  let cnt = 0
  const close = client.query('counter').subscribe(() => {
    cnt++
  })

  let cntChannel = 0
  const closeChannel = client
    .channel('a', { blablabla: 'blablabla' })
    .subscribe(() => {
      cntChannel++
    })

  t.true(true)

  await wait(300)

  client.channel('a', { blablabla: 'blablabla' }).publish('blablabla')

  close()
  closeChannel()

  await wait(100)
  const hardCnt = cnt
  const hardDebugCnt = debugMessages
  const hardchannelCnt = cntChannel

  await wait(2e3)
  t.is(cntChannel, hardchannelCnt, 'actualy unsubscribed channel')
  t.is(cnt, hardCnt, 'actualy unsubscribed')
  t.is(debugMessages, hardDebugCnt, 'no more messages received')

  client.disconnect()
  await server.destroy()
})
