import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import getPort from 'get-port'
import { wait } from '@saulx/utils'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('Call retry option', async (t: T) => {
  let cnt = 0
  let payloads = []
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: {
        hello: {
          type: 'function',
          fn: async (_, payload) => {
            payloads.push(payload)
            if (cnt > 5) {
              return 'ok'
            }
            cnt++
            throw new Error('Wrong ' + payload)
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

  let retry = 0

  const res = await client.call('hello', '', {
    retryStrategy: (err, time, retries) => {
      console.info(err, time, retries)
      retry = retries
      return 10
    },
  })

  t.is(retry, 5)
  t.is(res, 'ok')

  cnt = 0
  let check
  try {
    await client.call('hello', '', {
      retryStrategy: (err, time, retries) => {
        return false
      },
    })
  } catch (e) {
    check = true
  }

  t.true(check)

  cnt = 0
  payloads = []
  await client.call('hello', '', {
    retryStrategy: async (err, time, retries) => {
      await wait(500)
      retry = retries
      return { time: 0, payload: { retries } }
    },
  })

  t.deepEqual(payloads, [
    ,
    { retries: 0 },
    { retries: 1 },
    { retries: 2 },
    { retries: 3 },
    { retries: 4 },
    { retries: 5 },
  ])

  t.is(retry, 5)
  t.is(res, 'ok')

  client.disconnect()
  await server.destroy()
})
