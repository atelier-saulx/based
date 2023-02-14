import test from 'ava'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import { BasedClient } from '../src/index'

test.serial('rate limit', async (t) => {
  const server = await createSimpleServer({
    idleTimeout: 1e3,
    port: 9910,
    functions: {
      flap: async () => {
        return {}
      },
    },
  })

  const coreClient = new BasedClient()

  let limits = 0

  for (let i = 0; i < 2e3; i++) {
    const x = await fetch('http://localhost:9910/flap', {
      method: 'get',
      headers: {
        'content-type': 'application/json',
      },
    })
    if (x.status === 429) {
      limits++
    }
  }

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  t.is(limits, 1501)

  let isConnect = false
  coreClient.once('connect', () => {
    isConnect = true
  })

  await wait(5e3)

  t.is(isConnect, false)

  await wait(10e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})
