import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'
import { BasedError, BasedErrorCode } from '../src/types/error'

const setup = async () => {
  const coreClient = new BasedClient()
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    queryFunctions: {
      checkPayload: {
        closeAfterIdleTime: 1e3,
        function: (based, payload, update) => {
          update(payload.power)
          return () => {}
        },
      },
      counter: {
        closeAfterIdleTime: 0,
        function: async (based, payload, update) => {
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
        closeAfterIdleTime: 1e3,
        function: async (based, payload, update) => {
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
    functions: {
      nestedGetCheckPayload: async (based, payload) => {
        return based.query('checkPayload', payload).get()
      },
    },
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

  const power = await coreClient
    .query('checkPayload', {
      power: {
        msg: 'powerfull stuff',
      },
    })
    .get()

  t.is(power.msg, 'powerfull stuff')

  await wait(1e3)

  const power2 = await coreClient.call('nestedGetCheckPayload', {
    power: {
      msg: 'powerfull stuff',
    },
  })

  t.is(power2.msg, 'powerfull stuff')

  await wait(1e3)

  t.is(await coreClient.query('counter').get(), 0)

  await wait(100)

  t.is(await coreClient.query('counter').get(), 0)

  await wait(1000)

  // stays zero because it has 0 cache time
  t.is(await coreClient.query('counter').get(), 0)

  await wait(100)

  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)

  t.is(await coreClient.query('counter-cached').get(), 0)
  t.is(await coreClient.query('counter-cached').get(), 0)

  await wait(1500)

  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)

  await wait(6000)

  t.is(Object.keys(server.functions.specs).length, 0)
})

test.serial('authorize get', async (t) => {
  const { coreClient, server } = await setup()

  server.auth.updateConfig({
    authorize: async (server, context) => {
      return context.session?.authState.token === 'mock_token'
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

  await coreClient.setAuthState({ token: 'mock_token' })
  await t.notThrowsAsync(coreClient.query('counter').get())
})

test.serial('getWhen', async (t) => {
  const client = new BasedClient()
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    queryFunctions: {
      flap: (based, _payload, update) => {
        let cnt = 0
        const interval = setInterval(() => {
          cnt++
          update({ count: cnt, status: cnt > 1 })
        }, 100)

        return () => {
          clearInterval(interval)
        }
      },
    },
  })

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const g = await client.query('flap').getWhen((d) => d.status)

  t.is(g.count, 2)
})
