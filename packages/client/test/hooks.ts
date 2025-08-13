import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { wait } from '@based/utils'
import fetch from 'cross-fetch'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('Channel hook', async (t: T) => {
  let subCnt = 0
  let unSubCnt = 0
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    channel: {
      subscribe: () => {
        subCnt++
      },
      unsubscribe: () => {
        unSubCnt++
      },
    },
    functions: {
      configs: {
        blap: {
          closeAfterIdleTime: 500,
          type: 'channel',
          subscriber: (based, _payload, _id, update) => {
            return based.channel('mychannel').subscribe(update)
          },
        },
        mychannel: {
          type: 'channel',
          closeAfterIdleTime: 500,
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
    url: async () => t.context.ws,
  })
  const closeChannel = client
    .channel('mychannel', { bla: true })
    .subscribe(() => {})

  await wait(500)

  t.is(subCnt, 1)

  closeChannel()
  await wait(500)

  t.is(unSubCnt, 1)

  const closeChannel2 = client
    .channel('blap', { bla: true })
    .subscribe(() => {})

  await wait(500)

  t.is(subCnt, 3)

  closeChannel2()
  await wait(1500)

  t.is(unSubCnt, 3)

  client.disconnect()
  await server.destroy()
})

test('Query hook', async (t: T) => {
  let subCnt = 0
  let getCnt = 0
  let unSubCnt = 0
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
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
        flap: {
          type: 'function',
          fn: (based) => {
            return based.query('myobs').get()
          },
        },
        myobs2: {
          type: 'query',
          closeAfterIdleTime: 500,
          fn: (based, _payload, update) => {
            return based.query('myobs').subscribe(update)
          },
        },
        myobs: {
          type: 'query',
          closeAfterIdleTime: 500,
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
    url: async () => t.context.ws,
  })
  const close = client.query('myobs', { bla: true }).subscribe(() => {})

  await wait(500)

  t.is(subCnt, 1)

  close()
  await wait(500)

  t.is(unSubCnt, 1)

  await client.query('myobs').get()

  t.is(getCnt, 1)

  await (await fetch(t.context.http + '/myobs')).text()

  t.is(getCnt, 2)

  const close2 = client.query('myobs2', { bla: true }).subscribe(() => {})

  await wait(500)

  close2()

  await wait(1500)

  t.is(subCnt, 3)
  t.is(unSubCnt, 3)

  await client.call('flap')

  t.is(getCnt, 3)

  await (await fetch(t.context.http + '/flap')).text()

  t.is(getCnt, 4)

  client.disconnect()
  await server.destroy()
})

test('http.open', async (t: T) => {
  let openCnt = 0
  let closeCnt = 0
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    http: {
      open(ctx) {
        openCnt++
      },
      close(ctx) {
        closeCnt++
      },
    },
    functions: {
      configs: {
        hello: {
          type: 'function',
          fn: async () => {
            return 'hello!'
          },
        },
      },
    },
  })
  await server.start()

  const res = await fetch(`${t.context.http}/hello`)
  const text = await res.text()

  await server.destroy()

  t.is(text, 'hello!')
  t.is(openCnt, 1)
  t.is(closeCnt, 1)
})
