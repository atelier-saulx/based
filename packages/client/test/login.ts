import anyTest, { TestInterface } from 'ava'
import createServer from '@based/server'
import { start } from '@saulx/selva-server'
import based, { AuthLoginFunctionResponse } from '@based/client'
import { SelvaClient } from '@saulx/selva'
import { wait } from '@saulx/utils'

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
      user: {
        prefix: 'us',
        fields: {
          name: { type: 'string' },
          email: { type: 'string' },
          password: { type: 'digest' },
          status: { type: 'string' },
        },
      },
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

  let logoutFnCallCount = 0

  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      authorize: async ({ user }) => {
        return Boolean(user?._token)
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
          function: async () => {
            logoutFnCallCount++
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
  t.is(logoutFnCallCount, 1)

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
        return Boolean(user?._token)
      },
      functions: {
        login: {
          observable: false,
          function: async (): Promise<AuthLoginFunctionResponse> => {
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

test.serial('register', async (t) => {
  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      authorize: async ({ user, name, callStack }) => {
        if (name === 'registerUser' || callStack.length) {
          return true
        }
        return (await user?.token()) === 'bla'
      },
      functions: {
        registerUser: {
          observable: false,
          function: async ({ based, payload }) => {
            const { id } = await based.set({
              $id: await based.id('user', payload.email),
              email: payload.email,
              $alias: payload.email,
              password: payload.password,
            })
            return {
              token: 'bla',
              refreshToken: 'bla',
              email: payload.email,
              id,
            }
          },
        },
        login: {
          observable: false,
          function: async ({ based, payload }) => {
            const { id } = await based.get({ $alias: payload.email, id: true })
            return {
              token: 'bla',
              refreshToken: 'bla',
              email: payload.email,
              id,
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

  t.throwsAsync(
    client.get({
      users: {
        $all: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: {
              $field: 'type',
              $operator: '=',
              $value: 'user',
            },
          },
        },
      },
    })
  )

  const results: any[] = []

  const close = await client.observeUser((user) => {
    results.push(user)
  })

  await client.register({ email: 'me@me.com', password: 'smurk' })

  t.is(client.getToken(), 'bla')

  const users = await client.get({
    users: {
      $all: true,
      $list: {
        $find: {
          $traverse: 'children',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'user',
          },
        },
      },
    },
  })

  t.is(users.users.length, 1)

  await client.logout()

  await client.login({
    email: 'me@me.com',
    password: 'smurk',
  })

  await client.logout()

  close()

  await client.register({ email: 'me222@me.com', password: 'smurk' })

  await wait(200)

  const myUserId = await client.id('user', 'me@me.com')

  t.deepEqual(results, [
    false,
    { email: 'me@me.com', id: myUserId, token: 'bla' },
    false,
    { email: 'me@me.com', id: myUserId, token: 'bla' },
    false,
  ])

  t.teardown(async () => {
    await server.destroy()
    client.disconnect()
  })
})
