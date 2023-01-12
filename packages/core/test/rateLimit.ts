import test from 'ava'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import { BasedCoreClient } from '../src/index'

test.serial('rate limit', async (t) => {
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      flap: async () => {
        return {}
      },
    },
  })

  const coreClient = new BasedCoreClient()

  let isLimit = false
  let limits = 0

  for (let i = 0; i < 2e3; i++) {
    const x = await fetch('http://localhost:9910/flap', {
      method: 'get',
      headers: {
        'content-type': 'application/json',
      },
    })
    console.info(x.status)
    if (x.status === 429) {
      // console.info('bah ratelimit lets wait 30 seconds...')
      isLimit = true
      limits++
      // await wait(30e3)
    } else {
      // console.info('Pass', i)
    }
  }

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  console.info(limits)

  const x = await coreClient.call('flap')

  t.true(!!x)

  t.true(isLimit, 'is rate Limited')

  await wait(10e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})
