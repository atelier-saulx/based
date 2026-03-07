import test, { ExecutionContext } from 'ava'
import { wait } from '@based/utils'
import getPort from 'get-port'
import { BasedClient } from '../../src/client/index.js'
import { BasedServer } from '../../src/server/server.js'
import type {
  Authorize,
  BasedQueryFunction,
  VerifyAuthState,
} from '../../src/functions/index.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

let timeout: NodeJS.Timeout
const setup = async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
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

test('re-evaluate authState', async (t: T) => {
  const token = 'snurf_token'

  const { client, server } = await setup(t)

  t.teardown(() => {
    clearInterval(timeout)
    client.disconnect()
    server.destroy()
  })

  await client.connect({
    url: async () => {
      return t.context.ws
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
        (_err) => resolve(true),
      )
    }),
  )

  await wait(200)

  await client.setAuthState({})

  await wait(200)

  await client.setAuthState({ token: 'mock_token' })

  await wait(200)

  t.true(counter > 0)
})
