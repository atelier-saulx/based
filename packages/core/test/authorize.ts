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

test.serial('authorizeAdvanced', async (t) => {
  t.timeout(4000)

  const token = 'mock_token'

  const { coreClient, server } = await setup()

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

  // TODO: Change when throws on error
  // await t.throwsAsync(async () => {
  const result = await coreClient.function('hello', {
    bla: true,
  })
  console.log({ result })
  t.true(!!result.error)
  // })
  await coreClient.auth(token)
  // await t.notThrowsAsync(async () => {
  const result2 = await coreClient.function('hello', {
    bla: true,
  })
  console.log({ result2 })
  t.false(!!result2.error)
  // })
})
