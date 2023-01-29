import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'

test.serial('connect', async (t) => {
  const serverA = await createSimpleServer({
    port: 9910,
    functions: {
      hello: async (based, payload) => {
        if (payload) {
          return payload.length
        }
        return 'flap'
      },
    },
  })

  const serverB = await createSimpleServer({
    port: 9911,
    functions: {
      hello: async (based, payload) => {
        if (payload) {
          return payload.length
        }
        return 'flip'
      },
    },
  })

  const client = new BasedClient()

  await client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  t.is(await client.call('hello'), 'flap')

  await client.connect({
    url: async () => {
      return 'ws://localhost:9911'
    },
  })

  t.is(await client.call('hello'), 'flip')

  await serverA.destroy()
  await serverB.destroy()
})
