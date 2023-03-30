import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'
import { BasedError, BasedErrorCode } from '../src/types/error'
import { wait } from '@saulx/utils'
import { Authorize, BasedFunction, BasedQueryFunction } from '@based/functions'

const setup = async () => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: 9910,
    functions: {
      uninstallAfterIdleTime: 1e3,
      specs: {
        hello: {
          function: (async (_, payload) => {
            if (payload) {
              return payload
            }
            return 'flap'
          }) as BasedFunction,
        },
        counter: {
          query: true,
          function: (async (_, __, update) => {
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
      authorize: (async (_, ctx) => {
        return ctx.session?.authState.token === 'mock_token'
      }) as Authorize,
    },
  })

  await server.start()
  return { client, server }
}

test.serial('authorize functions', async (t) => {
  t.timeout(1000)

  const token = 'mock_token'

  const { client, server } = await setup()

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  await client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await t.throwsAsync(
    client.call('hello', {
      bla: true,
    })
  )

  await client.setAuthState({ token })

  await t.notThrowsAsync(
    client.call('hello', {
      bla: true,
    })
  )
})

test.serial('authorize observe', async (t) => {
  t.timeout(12000)

  const token = 'mock_token'

  const { client, server } = await setup()

  let counter: ReturnType<typeof setTimeout>

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  await client.connect({
    url: async () => {
      return 'ws://localhost:9910'
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
        }
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
        }
      )
  })

  // @ts-ignore - totally incorrect typescript error...
  clearInterval(counter)
})

test.serial('authorize after observe', async (t) => {
  t.timeout(12000)

  const token = 'mock_token'

  const { client, server } = await setup()
  let counter: ReturnType<typeof setTimeout>

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  await client.connect({
    url: async () => {
      return 'ws://localhost:9910'
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
      }
    )

  await wait(500)
  t.is(receiveCnt, 0)
  await client.setAuthState({ token })
  await wait(1500)

  // @ts-ignore - totally incorrect typescript error...
  clearInterval(counter)

  t.true(receiveCnt > 0)
})
