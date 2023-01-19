import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'
import { BasedError, BasedErrorCode } from '../src/types/error'

const setup = async () => {
  const coreClient = new BasedClient()
  const server = await createSimpleServer({
    port: 9910,
    observables: {
      counter: {
        memCacheTimeout: 0,
        function: async (_payload, update) => {
          let cnt = 0
          update(cnt)
          const counter = setInterval(() => {
            update(++cnt)
          }, 1000)
          return () => {
            clearInterval(counter)
          }
        },
      },
      'counter-cached': {
        memCacheTimeout: 1e3,
        function: async (_payload, update) => {
          let cnt = 0
          update(cnt)
          const counter = setInterval(() => {
            update(++cnt)
          }, 1000)
          return () => {
            clearInterval(counter)
          }
        },
      },
    },
    functions: {},
  })
  return { coreClient, server }
}

test.serial('get', async (t) => {
  const { coreClient, server } = await setup()

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

  t.is(await coreClient.query('counter').get(), 1)

  await wait(100)

  t.is(await coreClient.query('counter').get(), 1)

  await wait(100)

  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)

  t.is(await coreClient.query('counter-cached').get(), 1)
  t.is(await coreClient.query('counter-cached').get(), 1)

  await wait(1500)

  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)

  await wait(6000)

  t.is(Object.keys(server.functions.specs).length, 0)
})

test.serial('authorize get', async (t) => {
  const { coreClient, server } = await setup()

  server.auth.updateConfig({
    authorize: async (context) => {
      return context.session?.authState === 'mock_token'
    },
  })

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const error: BasedError = await t.throwsAsync(
    coreClient.query('counter').get()
  )
  t.is(error.code, BasedErrorCode.AuthorizeRejectedError)

  await coreClient.auth('mock_token')
  await t.notThrowsAsync(coreClient.query('counter').get())
})

test.serial('getWhen', async (t) => {
  const { coreClient, server } = await setup()

  server.functions.updateFunction({
    query: true,
    name: 'flap',
    checksum: 1,
    function: (_payload, update) => {
      let cnt = 0
      const interval = setInterval(() => {
        cnt++
        update({ count: cnt, status: cnt > 1 })
      }, 100)

      return () => {
        clearInterval(interval)
      }
    },
  })

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const g = await coreClient.query('flap').getWhen((d) => d.status)

  t.is(g.count, 2)
})
