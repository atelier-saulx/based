import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'

const setup = async () => {
  const coreClient = new BasedCoreClient()

  const store = {
    hello: async (payload: any) => {
      return payload.length
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

test.serial('authorize functions', async (t) => {
  t.timeout(4000)

  const token = 'mock_token'

  const { coreClient, server } = await setup()

  server.auth.updateConfig({
    authorize: async (_server, ws) => {
      return ws.authState === token
    },
  })

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  // TODO: Change when throws on error
  // await t.throwsAsync(async () => {
  const result = await coreClient.function('hello', {
    bla: true,
  })
  t.true(!!result.error)
  // })
  await coreClient.auth(token)
  // await t.notThrowsAsync(async () => {
  const result2 = await coreClient.function('hello', {
    bla: true,
  })
  t.false(!!result2.error)
  // })
})

test.serial.skip('authorize observe', async (t) => {
  t.timeout(4000)

  const token = 'mock_token'

  const { coreClient, server } = await setup()

  server.functions.update({
    observable: true,
    name: 'counter',
    // memCacheTimeout: 2e3,
    checksum: 2,
    function: async (payload, update) => {
      let cnt = 0
      const counter = setInterval(() => {
        update('UpdatedFn' + ++cnt)
      }, 100)
      return () => {
        clearInterval(counter)
      }
    },
  })

  server.auth.updateConfig({
    authorizeAdvanced: async (_server, ws) => {
      return ws.authState === token
    },
  })

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const close = coreClient.observe(
    'counter',
    (d) => {
      console.log({ d })
    },
    {
      myQuery: 123,
    }
  )

  await new Promise((resolve) => setTimeout(resolve, 3e3))

  close()
  t.fail()
})
