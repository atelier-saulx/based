import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'

const setup = async () => {
  const coreClient = new BasedCoreClient()

  const store = {
    hello: async (payload: any) => {
      return payload.length
    },
    lotsOfData: async () => {
      let str = ''
      for (let i = 0; i < 200000; i++) {
        str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
      }
      return str
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 3e3,
      unregister: async () => {
        return true
      },
      register: async ({ name }) => {
        if (store[name]) {
          return {
            name,
            checksum: 1,
            function: store[name],
          }
        } else {
          return false
        }
      },
      log: (opts) => {
        console.info('-->', opts)
      },
    },
  })
  return { coreClient, server }
}
test.serial('simple auth', async (t) => {
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
    t.is(result.token, token)
    authEventCount++
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const result = await coreClient.auth(token)
  t.true(result)
  t.is(coreClient.authState.token, token)
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
  coreClient.once('auth', () => {
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

  t.is(coreClient.authState?.token, 'second_token')
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

  t.is(coreClient.authState?.token, false)
})
