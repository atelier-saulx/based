import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/edge-server'
import { join } from 'path'
import { wait } from '@saulx/utils'

test.serial('call main request', async (t) => {
  const coreClient = new BasedCoreClient()

  const store = {
    mainApi: join(__dirname, '/functions', 'mainApi.js'),
  }

  const hello = async (payload) => {
    if (payload === 'crash') {
      throw new Error('crash!')
    }
    return 'HELLO ' + payload
  }

  const server = await createServer({
    port: 9910,
    workerRequest: (type, payload) => {
      if (type === 'hello') {
        return hello(payload)
      }
    },
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

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const result = await coreClient.function('mainApi', 'ja!')
  t.is(result, 'HELLO ja!')
  t.throwsAsync(coreClient.function('mainApi', 'crash'))

  await wait(1e3)
  coreClient.disconnect()
  await server.destroy()
})
