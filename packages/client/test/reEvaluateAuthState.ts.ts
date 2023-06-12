import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'
import {
  Authorize,
  BasedQueryFunction,
  VerifyAuthState,
} from '@based/functions'

let timeout: NodeJS.Timeout
const setup = async () => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: 9910,
    functions: {
      configs: {
        counter: {
          type: 'query',
          fn: (async (_, __, update) => {
            let cnt = 0
            update(cnt)
            timeout = setInterval(() => {
              update(++cnt)
            }, 500)
            return () => {
              clearInterval(timeout)
            }
          }) as BasedQueryFunction,
        },
      },
    },
    auth: {
      authorize: (async (based, ctx) => {
        await based.renewAuthState(ctx)
        return ctx.session?.authState.token === 'mock_token'
      }) as Authorize,
      verifyAuthState: (async (_based, _ctx, authState) => {
        if (authState?.token === 'mock_token') {
          return true
        }
        return { token: 'wrong_token' }
      }) as VerifyAuthState,
    },
  })

  await server.start()
  return { client, server }
}

test.serial('re-evaluate authState', async (t) => {
  const token = 'snurf_token'

  const { client, server } = await setup()

  t.teardown(() => {
    clearInterval(timeout)
    client.disconnect()
    server.destroy()
  })

  await client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await client.setAuthState({ token })

  let counter = 0
  await t.notThrowsAsync(
    new Promise((resolve) => {
      client.query('counter').subscribe(
        () => {
          counter++
        },
        (_err) => resolve(true)
      )
    })
  )

  await wait(200)

  await client.setAuthState({})

  await wait(200)

  await client.setAuthState({ token: 'mock_token' })

  await wait(200)

  t.true(counter > 0)
})
