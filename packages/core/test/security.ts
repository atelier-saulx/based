import test, { ExecutionContext } from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'

const setup = async (t: ExecutionContext) => {
  t.timeout(4000)

  const coreClient = new BasedCoreClient()

  const store = {
    hello: async (payload: any) => {
      return payload.length
    },
    authorizeAdvanced: async (payload) => {
      console.log('this is authorized advanced')
      return true
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

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  return { coreClient, server }
}

test.serial('security', async (t) => {
  const { coreClient, server } = await setup(t)

  server.auth.updateConfig({
    authorize: async (server, ws) => {
      const authorizeAdvanced = await server.functions.get('authorizeAdvanced')
      if (authorizeAdvanced) {
        //@ts-ignore
        console.log(await authorizeAdvanced.function('wawa', ws))
      }
      return true
    },
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await coreClient.function('hello')

  t.fail()
})
