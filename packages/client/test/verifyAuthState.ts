import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('verify auth state', async (t: T) => {
  t.timeout(4000)
  const client = new BasedClient()

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    auth: {
      verifyAuthState: async (_, __, authState) => {
        if (authState.token === '9000') {
          return { ...authState, type: 'over9000' }
        }

        if (
          authState.refreshToken === 'refresh' &&
          Number(authState.token) < Date.now() - 1e3
        ) {
          return {
            ...authState,
            token: '' + (Number(authState.token) + 1e3),
            type: authState.type
              ? 'fixed-' + (Number(authState.type.split('-')[1]) + 1)
              : 'fixed-0',
          }
        }

        if (Number(authState.token) < 100) {
          return { error: 'Token is too small' }
        }

        return true
      },
      authorize: async (based, ctx) => {
        if (!ctx.session) {
          return false
        }
        based.renewAuthState(ctx)
        if (ctx.session.authState.error) {
          return false
        }
        return true
      },
    },
    functions: {
      configs: {
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (_, payload) => {
            if (payload) {
              return payload.length
            }
            return 'flap'
          },
        },
      },
    },
  })
  await server.start()

  await client.connect({ url: t.context.ws })

  await client.call('hello')

  const err = await t.throwsAsync(client.setAuthState({ token: '20' }))

  t.is(err.message, 'Token is too small')

  const result = await client.setAuthState({ token: '9000' })

  t.is(result.type, 'over9000')

  let authstateChangeCnt = 0
  client.on('authstate-change', (a) => {
    authstateChangeCnt++
  })

  const token1 = '' + Date.now()
  await client.setAuthState({
    refreshToken: 'refresh',
    token: token1,
  })

  await client.call('hello')

  t.is(client.authState.token, token1)

  await wait(1e3)
  await client.call('hello')

  const token2 = client.authState.token
  t.true(Number(token2) > Number(token1))
  t.is(client.authState.type, 'fixed-0')

  await wait(1e3)
  await client.call('hello')

  const token3 = client.authState.token
  t.true(Number(token3) > Number(token2))
  t.is(client.authState.type, 'fixed-1')
  t.is(authstateChangeCnt, 3)

  await server.destroy()
  client.disconnect()
})
