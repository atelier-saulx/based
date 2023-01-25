import test from 'ava'
import { BasedClient } from '../src/index'
import {
  createSimpleServer,
  isWsContext,
  AuthState,
  WebSocketSession,
  HttpSession,
} from '@based/server'

const setup = async () => {
  const client = new BasedClient()

  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: {
        maxPayloadSize: 1e8,
        function: async (payload) => {
          if (payload) {
            return payload.length
          }
          return 'flap'
        },
      },
      lotsOfData: async () => {
        let str = ''
        for (let i = 0; i < 200000; i++) {
          str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
        }
        return str
      },
    },
  })
  return { client, server }
}

test.serial('auth string authState', async (t) => {
  t.timeout(4000)

  const token = 'mock_token'

  const { client, server } = await setup()

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  client.once('connect', () => {
    t.log('connect')
  })
  client.once('disconnect', () => {
    t.log('disconnect')
  })

  let authEventCount = 0
  client.once('authstate-change', (result) => {
    t.log('log', { result })
    t.is(result.token, token)
    authEventCount++
  })

  await client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const result = await client.setAuthState({ token })
  t.deepEqual(result, { token })
  t.is(client.authState.token, token)
  t.false(client.authRequest.inProgress)
  t.is(authEventCount, 1)
})

test.serial('authState simple', async (t) => {
  t.timeout(4000)

  const authState = {
    token: 'mock_token',
    renewToken: 'mock_renew_token',
    userId: 'usUser',
  }

  const { client, server } = await setup()

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  client.once('connect', () => {
    t.log('connect')
  })
  client.once('disconnect', () => {
    t.log('disconnect')
  })

  let authEventCount = 0
  client.once('authstate-change', (result: any) => {
    t.log('log', { result })
    t.deepEqual(result, authState)
    authEventCount++
  })

  await client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const result = await client.setAuthState(authState)
  t.deepEqual(result, authState)
  t.is(client.authState, authState)
  t.false(client.authRequest.inProgress)
  t.is(authEventCount, 1)
})

test.serial('multiple authState calls', async (t) => {
  t.timeout(4000)
  const { client, server } = await setup()

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  let authEventCount = 0
  client.on('authstate-change', () => {
    console.info('hello?')
    authEventCount++
  })

  await client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await client.setAuthState({ token: 'first_token' })

  await client.setAuthState({ token: 'second_token' })

  t.is(client.authState.token, 'second_token')
  t.is(authEventCount, 2)
})

test.serial('authState server clear', async (t) => {
  let serverSession: WebSocketSession | HttpSession

  t.timeout(4000)
  const { client, server } = await setup()

  t.teardown(() => {
    client.disconnect()
    server.destroy()
  })

  const serverAuthStates: Map<Number, AuthState> = new Map()

  server.auth.updateConfig({
    authorize: async (ctx) => {
      if (ctx.session) {
        serverSession = ctx.session
        serverAuthStates.set(ctx.session.id, ctx.session.authState)
      }
      return true
    },
  })

  console.info('connect')
  await client.connect({
    url: async () => {
      return 'ws://localhost:9910'
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

  console.info('set auth state')
  await client.setAuthState({ token: 'mock_token' })

  t.is(serverSession.authState.token, 'mock_token')

  console.info('clear auth state')
  await client.clearAuthState()

  t.is(serverSession.authState.token, undefined)

  t.is(client.authState.token, undefined)
})

test.serial('authState update', async (t) => {
  t.timeout(4000)
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
  await client.setAuthState({ token: 'mock_token' })
  await t.notThrowsAsync(client.call('hello'))
  server.auth.updateConfig({
    authorize: async (context) => {
      const authState = { token: 'second_token!', error: 'poopie' }
      if (context.session) {
        context.session.authState = authState
        if (isWsContext(context)) {
          server.auth.sendAuthState(context, authState)
        }
      }
      return true
    },
  })
  await client.setAuthState({ token: 'second_token' })
  await client.call('hello')
  t.deepEqual(client.authState, { token: 'second_token!', error: 'poopie' })
})
