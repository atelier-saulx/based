import anyTest, { TestInterface } from 'ava'
import createServer, { AuthorizeFn } from '@based/server'
import { start } from '@saulx/selva-server'
import based, { BasedError, BasedErrorCodes } from '@based/client'
import { SelvaClient } from '@saulx/selva'

const test = anyTest as TestInterface<{
  db: SelvaClient
}>

const authorize: AuthorizeFn = async ({ user }) => {
  if (user._token === 'expiredToken') {
    const basedError = new BasedError('Token expired')
    basedError.code = BasedErrorCodes.TokenExpired
    throw basedError
  } else if (user._token === 'validToken') {
    return true
  }
  return false
}

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

test.serial('should renew a token', async (t) => {
  t.timeout(5000)
  let refreshTokenCallCount = 0

  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      authorize,
      functions: {
        login: {
          observable: false,
          function: async () => {
            return {
              token: 'expiredToken',
              refreshToken: 'validRefreshToken',
            }
          },
        },
        renewToken: {
          observable: false,
          function: async ({ payload }) => {
            refreshTokenCallCount++
            const { refreshToken } = payload
            if (refreshToken === 'validRefreshToken') {
              return { token: 'validToken' }
            }
            throw new Error('invalid refreshToken')
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

  await client.login({ email: 'existing@user.com', password: 'smurk' })
  const result = await client.get({ $id: 'root', id: true })
  t.is(result.id, 'root')
  t.is(refreshTokenCallCount, 1)
})

test.serial('should throw with invalid refreshToken', async (t) => {
  t.timeout(5000)
  // t.plan(1)
  let refreshTokenCallCount = 0

  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      authorize,
      functions: {
        login: {
          observable: false,
          function: async () => {
            return {
              token: 'expiredToken',
              refreshToken: 'invalid refreshToken',
            }
          },
        },
        renewToken: {
          observable: false,
          function: async ({ payload }) => {
            refreshTokenCallCount++
            const { refreshToken } = payload
            if (refreshToken === 'validRefreshToken') {
              return { token: 'validToken' }
            }
            throw new Error('invalid refreshToken')
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

  await client.login({ email: 'existing@user.com', password: 'smurk' })
  const error = await t.throwsAsync(async () => {
    await client.get({ $id: 'root', id: true })
  })
  t.regex(error.name, /^RenewTokenError/)
  t.is(refreshTokenCallCount, 1)
})

test.serial('should renew a token with subscription', async (t) => {
  t.plan(2)
  t.timeout(15000)
  let refreshTokenCallCount = 0

  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      authorize,
      functions: {
        login: {
          observable: false,
          function: async () => {
            return {
              token: 'expiredToken',
              // token: 'validToken',
              refreshToken: 'validRefreshToken',
            }
          },
        },
        renewToken: {
          observable: false,
          function: async ({ payload }) => {
            refreshTokenCallCount++
            const { refreshToken } = payload
            if (refreshToken === 'validRefreshToken') {
              return { token: 'validToken' }
            }
            throw new Error('invalid refreshToken')
          },
        },
        wawa: {
          shared: false,
          observable: true,
          function: async ({ based, update }) => {
            return based.observe(
              {
                $id: 'thWawa',
                name: true,
              },
              (d) => {
                update({
                  d,
                })
              }
            )
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

  await client.login({ email: 'existing@user.com', password: 'smurk' })
  await client.observe('wawa', (r) => {
    if (r?.d?.name === 'yeye') {
      t.pass()
    }
  })
  await t.context.db.set({
    $id: 'thWawa',
    name: 'yeye',
  })
  await new Promise((resolve) => setTimeout(resolve, 1000))
  t.is(refreshTokenCallCount, 1)
})

test.serial.only('should renew a token with subscription2', async (t) => {
  t.plan(2)
  t.timeout(15000)
  let refreshTokenCallCount = 0

  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      authorize,
      functions: {
        login: {
          observable: false,
          function: async () => {
            return {
              token: 'expiredToken',
              // token: 'validToken',
              refreshToken: 'validRefreshToken',
            }
          },
        },
        renewToken: {
          observable: false,
          function: async ({ payload }) => {
            refreshTokenCallCount++
            const { refreshToken } = payload
            if (refreshToken === 'validRefreshToken') {
              return { token: 'validToken' }
            }
            throw new Error('invalid refreshToken')
          },
        },
        wawa: {
          shared: false,
          observable: true,
          function: async ({ based, update }) => {
            return based.observe(
              {
                $id: 'thWawa',
                name: true,
              },
              (d) => {
                update({
                  d,
                })
              }
            )
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

  await client.auth('expiredToken', { refreshToken: 'validRefreshToken' })
  await client.observe('wawa', (r) => {
    if (r?.d?.name === 'yeye') {
      t.pass()
    }
  })
  await t.context.db.set({
    $id: 'thWawa',
    name: 'yeye',
  })
  await new Promise((resolve) => setTimeout(resolve, 1000))
  t.is(refreshTokenCallCount, 1)
})
