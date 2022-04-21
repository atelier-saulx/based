import anyTest, { TestInterface } from 'ava'
import createServer from '@based/server'
import { start, startOrigin } from '@saulx/selva-server'
import based, { AuthLoginFunctionResponse } from '@based/client'
import { SelvaClient } from '@saulx/selva'

const test = anyTest as TestInterface<{
  db: SelvaClient
  publicKey: string
  privateKey: string
}>

test.before(async (t) => {
  const selvaServer = await start({
    port: 9401,
  })
  t.context.db = selvaServer.selvaClient
  // @ts-ignore
  await t.context.db.updateSchema({
    types: {
      thing: {
        prefix: 'th',
        fields: {
          name: { type: 'string' },
          nested: {
            type: 'object',
            properties: {
              something: { type: 'string' },
            },
          },
        },
      },
    },
  })
})

test.after(async (t) => {
  await t.context.db.destroy()
})

test.serial(
  'should throw if loggin in without setting login function',
  async (t) => {
    const server = await createServer({
      port: 9333,
      db: {
        host: 'localhost',
        port: 9401,
      },
      config: {
        functions: {},
      },
    })
    const client = based({
      url: async () => {
        return 'ws://localhost:9333'
      },
    })
    t.teardown(async () => {
      await server.destroy()
      client.disconnect()
    })

    await t.throwsAsync(async () => {
      await client.login({ email: 'me', password: 'smurk' })
    })
  }
)

test.serial('should login and logout', async (t) => {
  t.timeout(5000)

  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      authorize: async ({ user }) => {
        return Boolean(user._token)
      },
      functions: {
        login: {
          observable: false,
          function: async ({ payload }): Promise<AuthLoginFunctionResponse> => {
            const { email } = payload
            if (email === 'existing@user.com') {
              return {
                id: 'wawa',
                email: 'wawa',
                name: 'wawa',
                token: 'fakeToken',
                refreshToken: 'fakeRefreshToken',
              }
            }
            throw new Error('User not found')
          },
        },
        logout: {
          observable: false,
          function: async ({}) => {
            return {}
          },
        },
      },
    },
  })
  const client = based({
    url: async () => {
      return 'ws://localhost:9333'
    },
  })
  t.teardown(async () => {
    await server.destroy()
    client.disconnect()
  })

  await t.notThrowsAsync(async () => {
    const response = await client.login({
      email: 'existing@user.com',
      password: 'smurk',
    })
    t.is(typeof response.token, 'string')
  })

  const x = await client.get({
    $id: 'root',
    id: true,
  })
  t.is(x.id, 'root')

  await t.notThrowsAsync(async () => {
    await client.logout()
  })

  const error = await t.throwsAsync(async () => {
    await client.get({
      $id: 'root',
      id: true,
    })
  })
  t.regex(error.name, /^AuthorizationError/)

  const errorLogin = await t.throwsAsync(async () => {
    await client.login({
      email: 'nonexisting@user.com',
      password: 'smurk',
    })
  })
  t.regex(errorLogin.name, /^LoginError/)
})

test.serial('should not fail logout function does not exist', async (t) => {
  t.timeout(5000)

  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      authorize: async ({ user }) => {
        return Boolean(user._token)
      },
      functions: {
        login: {
          observable: false,
          function: async ({}): Promise<AuthLoginFunctionResponse> => {
            return {
              id: 'wawa',
              email: 'wawa',
              name: 'wawa',
              token: 'fakeToken',
              refreshToken: 'fakeRefreshToken',
            }
          },
        },
      },
    },
  })
  const client = based({
    url: async () => {
      return 'ws://localhost:9333'
    },
  })
  t.teardown(async () => {
    await server.destroy()
    client.disconnect()
  })

  await client.login({
    email: 'existing@user.com',
    password: 'smurk',
  })

  const x = await client.get({
    $id: 'root',
    id: true,
  })
  t.is(x.id, 'root')

  await t.notThrowsAsync(async () => {
    await client.logout()
  })

  const error = await t.throwsAsync(async () => {
    await client.get({
      $id: 'root',
      id: true,
    })
  })
  t.regex(error.name, /^AuthorizationError/)
})
