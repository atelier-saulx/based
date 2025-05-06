import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { wait } from '@saulx/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('addSpecs', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
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
  // let msgCnt = 0

  client.query('cookie').subscribe(
    () => {},
    () => {
      errCnt++
    },
  )

  await wait(500)

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
  // t.is(msgCnt, 1) TODO: have to make this

  await server.destroy()
  await client.destroy()

  t.true(true)
})
