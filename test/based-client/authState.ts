import test, { ExecutionContext } from 'ava'
import getPort from 'get-port'
import { BasedClient } from '../../src/client/index.js'
import { BasedServer } from '../../src/server/server.js'
import {
  isWsContext,
  type HttpSession,
  type WebSocketSession,
} from '../../src/functions/context.js'
import type { AuthState } from '../../src/functions/auth.js'

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
        hello: {
          type: 'function',
          maxPayloadSize: 1e8,
          uninstallAfterIdleTime: 1e3,
          fn: async (_, payload) => {
            if (payload) {
              return payload.length
            }
            return 'flap'
          },
        },
        lotsOfData: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            let str = ''
            for (let i = 0; i < 200000; i++) {
              str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
            }
            return str
          },
        },
      },
    },
  })
  await server.start()
  return { client, server }
}

test('auth string authState', async (t: T) => {
  t.timeout(4000)

  const token = 'mock_token'

  const { client, server } = await setup(t)

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  let authEventCount = 0

  client.once('authstate-change', (result) => {
    t.is(result.token, token)
    authEventCount++
  })

  await client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const result = await client.setAuthState({ token })
  t.deepEqual(result, { token, v: 2 })
  t.is(client.authState.token, token)
  t.false(client.authRequest.inProgress)
  t.is(authEventCount, 1)
})

test('authState simple', async (t: T) => {
  t.timeout(4000)

  const authState = {
    token: 'mock_token',
    renewToken: 'mock_renew_token',
    userId: 'usUser',
  }

  const { client, server } = await setup(t)

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  let authEventCount = 0
  client.once('authstate-change', (result: any) => {
    t.deepEqual(result, authState)
    authEventCount++
  })

  await client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const result = await client.setAuthState(authState)
  t.deepEqual(result, authState)
  t.is(client.authState, authState)
  t.false(client.authRequest.inProgress)
  t.is(authEventCount, 1)
})

test('multiple authState calls', async (t: T) => {
  t.timeout(4000)
  const { client, server } = await setup(t)

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  let authEventCount = 0
  client.on('authstate-change', () => {
    authEventCount++
  })

  await client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  await client.setAuthState({ token: 'first_token' })

  await client.setAuthState({ token: 'second_token' })

  t.is(client.authState.token, 'second_token')
  t.is(authEventCount, 2)
})

test('authState server clear', async (t: T) => {
  let serverSession: WebSocketSession | HttpSession

  t.timeout(4000)
  const { client, server } = await setup(t)

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  const serverAuthStates: Map<Number, AuthState> = new Map()

  server.auth.updateConfig({
    authorize: async (_, ctx) => {
      if (ctx.session) {
        serverSession = ctx.session
        serverAuthStates.set(ctx.session.id, ctx.session.authState)
      }
      return true
    },
  })

  await client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  await client.call('hello')

  // @ts-ignore
  if (!serverSession) {
    t.fail('no authstate set on server')
    return
  }

  t.is(serverAuthStates.size, 1)

  t.is(serverSession.authState.token, undefined)

  await client.call('hello')

  await client.setAuthState({ token: 'mock_token' })

  t.is(serverSession.authState.token, 'mock_token')

  await client.clearAuthState()

  t.is(serverSession.authState.token, undefined)

  t.is(client.authState.token, undefined)
})

test('authState update', async (t: T) => {
  t.timeout(4000)
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
  await client.setAuthState({ token: 'mock_token' })
  await t.notThrowsAsync(client.call('hello'))
  server.auth.updateConfig({
    authorize: async (based, context) => {
      const authState = { token: 'second_token!', error: 'poopie' }
      if (context.session) {
        context.session.authState = authState
        if (isWsContext(context)) {
          based.sendAuthState(context, authState)
        }
      }
      return true
    },
  })
  await client.setAuthState({ token: 'second_token' })
  await client.call('hello')
  t.deepEqual(client.authState, { token: 'second_token!', error: 'poopie' })
})

test('authState 16byte chars encoded on start', async (t: T) => {
  t.timeout(4000)
  const { client, server } = await setup(t)
  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  const oAuthState = {
    type: '🤪',
    token: `-----BEGIN PUBLIC KEY-----
    MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf
    9Cnzj4p4WGeKLs1Pt8QuKUpRKfFLfRYC9AIKjbJTWit+CqvjWYzvQwECAwEAAQ==
    -----END PUBLIC KEY-----`,
    refreshToken:
      'BwIAAACkAABSU0EyAAIAAAEAAQABQ++MWeOrCn4rWlOyjQoC9AIWfUvxKVFKKS7Et0/NLopnWHiKj/Mp9N/T1nL66BdRnMiCLQ330v0QFjFp4PeoHTYUW2QTrHy9HgBNsIRjS2JOtidKzt+iu3ieATK/EqM1G0dmccMhqf02Bk/0NxxNAfo3XENs9nu6ncwJRRpBCQEJAuYqPeWw878y5Xdxp7XoB5/QEqc+NqwG6PJzn7OEbYnevstdNEghgR4wjsfDQEVluz7RsP3HFsEbWI9oES7JNE1ge994WQVh4KwYYMYTUmogfcFtuyx1Ewo+opP/rBNNpN0xkPEcvqarkUGbkZg1BPTyvDbMxvcpCTZweON7W11FnpP7R5sgQE/PekvLhnqjJoGa0oBLaJGqthzE4pIg',
  }

  client.setAuthState(oAuthState)

  await client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  let aState: AuthState = {}

  server.auth.updateConfig({
    authorize: async (_, context) => {
      if (context.session) {
        aState = context.session.authState
      }
      return true
    },
  })

  await client.call('hello')
  t.deepEqual(aState, oAuthState)
})
