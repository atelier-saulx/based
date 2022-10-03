import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer, { isHttpClient } from '@based/server'
import { wait } from '@saulx/utils'
import { BasedError, BasedErrorCode } from '../src/types/error'

const setup = async () => {
  const coreClient = new BasedCoreClient()

  const obsStore = {
    counter: async (_payload: any, update: any) => {
      let cnt = 0
      const counter = setInterval(() => {
        update(++cnt)
      }, 1000)
      return () => {
        clearInterval(counter)
      }
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 0,
      idleTimeout: 1e3,

      route: ({ name }) => {
        if (name === 'counter-cached') {
          return {
            observable: true,
            name: 'counter-cached',
          }
        }
        if (name && obsStore[name]) {
          return { name, observable: true }
        }
        return false
      },

      uninstall: async (opts) => {
        console.info('unRegister', opts.name)
        return true
      },
      install: async ({ name }) => {
        if (name === 'counter-cached') {
          return {
            observable: true,
            name: 'counter-cached',
            checksum: 1,
            function: obsStore.counter,
            memCacheTimeout: 1e3,
          }
        }

        if (obsStore[name]) {
          return {
            observable: true,
            name,
            checksum: 1,
            function: obsStore[name],
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

test.serial('get', async (t) => {
  const { coreClient, server } = await setup()

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

  t.is(await coreClient.get('counter'), 1)

  await wait(100)

  t.is(await coreClient.get('counter'), 1)

  await wait(100)

  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)

  t.is(await coreClient.get('counter-cached'), 1)
  t.is(await coreClient.get('counter-cached'), 1)

  await wait(1500)

  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)

  await wait(6000)

  t.is(Object.keys(server.functions.observables).length, 0)
})

test.serial('authorize get', async (t) => {
  const { coreClient, server } = await setup()

  const token = 'mock_token'

  server.auth.updateConfig({
    authorize: async (_server, client) => {
      if (isHttpClient(client)) {
        if (client.context) {
          return client.context.authState === token
        }
      } else {
        if (client.ws) {
          return client.ws.authState === token
        }
      }
      return false
    },
  })

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  // coreClient.once('connect', (isConnected) => {
  //   t.log('connect', isConnected)
  // })

  const error: BasedError = await t.throwsAsync(coreClient.get('counter'))
  t.is(error.basedCode, BasedErrorCode.AuthorizeRejectedError)

  await coreClient.auth(token)
  await t.notThrowsAsync(coreClient.get('counter'))
})
