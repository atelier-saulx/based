import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { BasedError, BasedErrorCode } from '@based/errors'
import { wait } from '@based/utils'
import { Authorize, BasedFunction, BasedQueryFunction } from '@based/functions'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

const setup = async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        login: {
          type: 'function',
          public: true,
          fn: async (based, payload, ctx) => {
            await based.renewAuthState(ctx, {
              token: payload.token,
            })
            return true
          },
        },

        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: (async (_, payload) => {
            if (payload) {
              return payload
            }
            return 'flap'
          }) as BasedFunction,
        },
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (async (_, __, update) => {
            let cnt = 0
            update(cnt)
            const counter = setInterval(() => {
              update(++cnt)
            }, 1000)
            return () => {
              clearInterval(counter)
            }
          }) as BasedQueryFunction,
        },
      },
    },
    auth: {
      // TODO: make this the default...
      verifyAuthState: async (_, ctx, authState) => {
        if (authState.token !== ctx.session?.authState.token) {
          return { ...authState }
        }
        return true
      },
      authorize: (async (_, ctx) => {
        return ctx.session?.authState.token === 'mock_token'
      }) as Authorize,
    },
  })

  await server.start()
  return { client, server }
}

test('authorize functions', async (t: T) => {
  t.timeout(1000)

  const token = 'mock_token'

  const { client, server } = await setup(t)

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  await client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  await t.throwsAsync(
    client.call('hello', {
      bla: true,
    }),
  )

  await client.setAuthState({ token })

  await t.notThrowsAsync(
    client.call('hello', {
      bla: true,
    }),
  )
})

test('authorize observe', async (t: T) => {
  t.timeout(12000)

  const token = 'mock_token'

  const { client, server } = await setup(t)

  let counter: ReturnType<typeof setTimeout>

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  await client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  await new Promise((resolve) => {
    client
      .query('counter', {
        myQuery: 123,
      })
      .subscribe(
        () => {},
        (err: BasedError) => {
          t.is(err.code, BasedErrorCode.AuthorizeRejectedError)
          resolve(err)
        },
      )
  })

  await client.setAuthState({ token })
  await wait(500)

  await new Promise((resolve) => {
    client
      .query('counter', {
        myQuery: 123,
      })
      .subscribe(
        (d) => {
          resolve(d)
        },
        (err: BasedError) => {
          t.fail('Should not error when authed')
          resolve(err)
        },
      )
  })

  // @ts-ignore - totally incorrect typescript error...
  clearInterval(counter)
})

test('authorize after observe', async (t: T) => {
  t.timeout(12000)

  const token = 'mock_token'

  const { client, server } = await setup(t)
  let counter: ReturnType<typeof setInterval>

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  await client.connect({
    url: async () => {
      return t.context.ws
    },
  })
  await wait(500)

  let receiveCnt = 0

  client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe(
      () => {
        receiveCnt++
      },
      (err: BasedError) => {
        t.is(err.code, BasedErrorCode.AuthorizeRejectedError)
      },
    )

  await wait(500)
  t.is(receiveCnt, 0)
  await client.setAuthState({ token })
  await wait(1500)

  // @ts-ignore - totally incorrect typescript error...
  clearInterval(counter)

  t.true(receiveCnt > 0)
})

test('authorize from server after observe', async (t: T) => {
  t.timeout(12000)

  const token = 'mock_token'

  const { client, server } = await setup(t)

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  await client.connect({
    url: async () => {
      return t.context.ws
    },
  })
  await wait(500)

  let receiveCnt = 0

  client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe(
      () => {
        receiveCnt++
      },
      (err: BasedError) => {
        t.is(err.code, BasedErrorCode.AuthorizeRejectedError)
      },
    )

  await wait(500)
  t.is(receiveCnt, 0)
  await client.call('login', {
    token,
  })
  await wait(1500)

  t.true(receiveCnt > 0)

  t.true(true)
})
