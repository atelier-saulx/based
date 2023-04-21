import test from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'

test.serial('Call retry option', async (t) => {
  let cnt = 0

  const server = new BasedServer({
    port: 9910,
    functions: {
      configs: {
        hello: {
          type: 'function',
          fn: async (_, payload) => {
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
    url: async () => 'ws://localhost:9910',
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
  client.disconnect()
  await server.destroy()
})
