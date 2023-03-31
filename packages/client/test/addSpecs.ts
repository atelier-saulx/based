import test from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index'
import { wait } from '@saulx/utils'

test.serial('addSpecs', async (t) => {
  const server = new BasedServer({
    port: 9910,
    functions: {
      uninstallAfterIdleTime: 1e3,
      configs: {
        bla: {
          type: 'query',
          fn: (based, payload, update) => {
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
    url: 'ws://localhost:9910',
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
    (d) => {
      // msgCnt++
      console.info('cookie time', d)
    },
    (err) => {
      errCnt++
      console.error('cookie error', err)
    }
  )

  await wait(500)

  // To solve this we need a new protocol msg
  // what it will do will send fns added
  // that will then resend re-subscribe requests for errored subs
  server.functions.add({
    cookie: {
      type: 'query',
      fn: (based, payload, update) => {
        update('SNUR')
        return () => {}
      },
    },
  })

  await wait(500)

  t.is(errCnt, 1)
  // t.is(msgCnt, 1) TODO: have to make this

  await server.destroy()

  t.true(true)
})
