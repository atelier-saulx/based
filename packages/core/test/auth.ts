import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/edge-server'
import { join } from 'path'

const setup = async () => {
  const coreClient = new BasedCoreClient()

  const store = {
    hello: join(__dirname, '/functions', 'hello.js'),
    lotsOfData: join(__dirname, '/functions', 'lotsOfData.js'),
  }

  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 3e3,
      route: ({ name }) => {
        if (name && store[name]) {
          return {
            name,
          }
        }
        return false
      },
      uninstall: async () => {
        return true
      },
      install: async ({ name }) => {
        if (store[name]) {
          return {
            name,
            checksum: 1,
            functionPath: store[name],
          }
        } else {
          return false
        }
      },
    },
  })
  return { coreClient, server }
}

test.serial('auth string authState', async (t) => {
  t.timeout(4000)

  const token = 'mock_token'

  const { coreClient, server } = await setup()

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.once('connect', () => {
    t.log('connect')
  })
  coreClient.once('disconnect', () => {
    t.log('disconnect')
  })

  let authEventCount = 0
  coreClient.once('auth', (result: any) => {
    t.log('log', { result })
    t.is(result, token)
    authEventCount++
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const result = await coreClient.auth(token)
  t.true(result)
  t.is(coreClient.authState, token)
  t.false(coreClient.authRequest.inProgress)
  t.is(authEventCount, 1)
})

test.serial('auth object authState', async (t) => {
  t.timeout(4000)

  const authState = {
    token: 'mock_token',
    renewToken: 'mock_renew_token',
    userId: 'usUser',
  }

  const { coreClient, server } = await setup()

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.once('connect', () => {
    t.log('connect')
  })
  coreClient.once('disconnect', () => {
    t.log('disconnect')
  })

  let authEventCount = 0
  coreClient.once('auth', (result: any) => {
    t.log('log', { result })
    t.deepEqual(result, authState)
    authEventCount++
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const result = await coreClient.auth(authState)
  t.true(result)
  t.is(coreClient.authState, authState)
  t.false(coreClient.authRequest.inProgress)
  t.is(authEventCount, 1)
})

test.serial('multiple auth calls', async (t) => {
  t.timeout(4000)
  const { coreClient, server } = await setup()

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  let authEventCount = 0
  coreClient.on('auth', () => {
    authEventCount++
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await t.notThrowsAsync(async () => {
    await coreClient.auth('first_token')
    await coreClient.auth('second_token')
  })

  t.is(coreClient.authState, 'second_token')
  t.is(authEventCount, 2)
})

test.serial('auth out', async (t) => {
  t.timeout(4000)
  const { coreClient, server } = await setup()

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await t.notThrowsAsync(async () => {
    await coreClient.auth('mock_token')
    await coreClient.auth(false)
  })

  t.is(coreClient.authState, false)
})

test.serial('authState update', async (t) => {
  t.timeout(4000)
  const { coreClient, server } = await setup()

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await coreClient.auth('mock_token')

  await t.notThrowsAsync(coreClient.function('hello'))
  server.auth.updateConfig({
    authorizePath: join(__dirname, 'functions', 'authAdvanced'),
  })
  await coreClient.auth('second_token')

  await coreClient.function('hello')
  t.deepEqual(coreClient.authState, 'second_token')
})
