import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { wait } from '@based/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('lazyConnect', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        bla: {
          type: 'query',
          fn: (_, __, update) => {
            update('?')
            return () => {}
          },
        },
        bye: {
          type: 'function',
          fn: async () => {
            return 'flap'
          },
        },
      },
    },
  })

  await server.start()

  const client = new BasedClient({
    url: t.context.ws,
    lazy: {
      keepAlive: 100,
    },
  })

  var connect = 0
  var disconnect = 0

  client.on('connect', () => {
    connect++
  })

  client.on('disconnect', () => {
    disconnect++
  })

  server.functions.add({
    hello: {
      type: 'function',
      fn: async () => 'x',
    },
  })

  t.is(await client.call('hello'), 'x')
  t.is(await client.call('bye'), 'flap')

  let errCnt = 0

  await wait(2e3)
  // let msgCnt = 0

  const close = client.query('cookie').subscribe(
    () => {},
    () => {
      errCnt++
    },
  )

  await wait(2000)

  // To solve this we need a new protocol msg
  // what it will do will send fns added
  // that will then resend re-subscribe requests for errored subs
  server.functions.add({
    cookie: {
      type: 'query',
      fn: (_, __, update) => {
        update('SNUR')
        return () => {}
      },
    },
  })

  await wait(500)

  t.is(errCnt, 1)

  close()

  await wait(500)

  t.is(await client.call('hello'), 'x')

  t.is(connect, 3)
  t.is(disconnect, 2)

  await server.destroy()
  await client.destroy()
})
