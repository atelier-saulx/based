import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'

test.serial('connect', async (t) => {
  const serverA = new BasedServer({
    port: 9910,
    functions: {
      specs: {
        hello: {
          uninstallAfterIdleTime: 1e3,
          function: async (based, payload) => {
            if (payload) {
              return payload.length
            }
            return 'flap'
          },
        },
      },
    },
  })
  await serverA.start()

  const serverB = new BasedServer({
    port: 9911,
    functions: {
      specs: {
        hello: {
          uninstallAfterIdleTime: 1e3,
          function: async (based, payload) => {
            if (payload) {
              return payload.length
            }
            return 'flip'
          },
        },
      },
    },
  })
  await serverB.start()

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
