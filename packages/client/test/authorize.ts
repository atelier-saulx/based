import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { BasedError, BasedErrorCode } from '../src/types/error'
import { wait } from '@saulx/utils'

const setup = async () => {
  const client = new BasedClient()
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    functions: {
      hello: async (based, payload) => {
        if (payload) {
          return payload
        }
        return 'flap'
      },
    },
    queryFunctions: {
      counter: async (based, payload, update) => {
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
    auth: {
      authorize: async (based, ctx) => {
        return ctx.session?.authState.token === 'mock_token'
      },
    },
  })
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
