import test, { ExecutionContext } from 'ava'
import { wait } from '@based/utils'
import { BasedError, BasedErrorCode } from '@based/errors'
import getPort from 'get-port'
import { BasedClient } from '../../src/client/index.js'
import { BasedServer } from '../../src/server/index.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

const setup = async (t: T) => {
  const coreClient = new BasedClient()
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: {
        any: {
          type: 'query',
          closeAfterIdleTime: 0,
          uninstallAfterIdleTime: 1e3,
          fn: (_, payload, update) => {
            update(payload)
            return () => {}
          },
        },
        nestedAny: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload) => {
            const bla = await based.query('any', payload).get()
            return bla
          },
        },
        checkPayload: {
          type: 'query',
          closeAfterIdleTime: 1e3,
          uninstallAfterIdleTime: 1e3,
          fn: (_, payload, update) => {
            update(payload.power)
            return () => {}
          },
        },
        counter: {
          type: 'query',
          closeAfterIdleTime: 0,
          uninstallAfterIdleTime: 1e3,
          fn: async (_, __, update) => {
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
          type: 'query',
          closeAfterIdleTime: 1e3,
          uninstallAfterIdleTime: 1e3,
          fn: async (_, __, update) => {
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
        nestedGetCheckPayload: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload) => {
            return based.query('checkPayload', payload).get()
          },
        },
      },
    },
  })
  await server.start()
  return { coreClient, server }
}

test('get while subscribed', async (t: T) => {
  const { coreClient, server } = await setup(t)

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const res0 = await new Promise<any>((resolve) => {
    coreClient.query('any', 'xxx').subscribe((res) => {
      resolve(res)
    })
  })
  t.is(res0, 'xxx')
  const res1 = await coreClient.query('any', 'xxx').get()
  t.is(res1, res0)
  const res2 = await coreClient.query('any', 'xxx').get()
  t.is(res2, res1)
})

test('get', async (t: T) => {
  const { coreClient, server } = await setup(t)

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const str = await coreClient.query('any', 'xxx').get()
  t.is(str, 'xxx')
  const nestedStr = await coreClient.call('nestedAny', 'xxx')
  t.is(nestedStr, 'xxx')
  const num = await coreClient.query('any', 19).get()
  t.is(num, 19)
  const nestedNum = await coreClient.call('nestedAny', 19)
  t.is(nestedNum, 19)
  const boolTrue = await coreClient.query('any', true).get()
  t.is(boolTrue, true)
  const nestedBoolTrue = await coreClient.call('nestedAny', true)
  t.is(nestedBoolTrue, true)
  const boolFalse = await coreClient.query('any', false).get()
  t.is(boolFalse, false)
  const nestedBoolFalse = await coreClient.call('nestedAny', false)
  t.is(nestedBoolFalse, false)

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

  await wait(1000)

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

test.only('authorize get', async (t: T) => {
  const { coreClient, server } = await setup(t)

  server.auth.updateConfig({
    authorize: async (_, context) => {
      return context.session?.authState.token === 'mock_token'
    },
  })

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const error: BasedError = await t.throwsAsync(
    coreClient.query('counter').get(),
  )

  t.is(error.code, BasedErrorCode.AuthorizeRejectedError)

  await coreClient.setAuthState({ token: 'mock_token' })

  await t.notThrowsAsync(coreClient.query('counter').get())
})

test('getWhen', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: {
        flap: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
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
      },
    },
  })
  await server.start()

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const g = await client.query('flap').getWhen((d) => d.status)

  t.is(g.count, 2)
})
