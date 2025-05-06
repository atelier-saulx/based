import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('message incoming/outgoing', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        a: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          subscriber: (_, __, ___, update) => {
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
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
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
    },
  })
  await server.start()

  client.connect({
    url: async () => {
      return t.context.ws
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
  const hardchannelCnt = cntChannel

  await wait(2e3)
  t.is(cntChannel, hardchannelCnt, 'actualy unsubscribed channel')
  t.is(cnt, hardCnt, 'actualy unsubscribed')

  client.disconnect()
  await server.destroy()
})
