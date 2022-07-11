import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'
import { wait } from '@saulx/utils'

// import basedCoreClient from '../src'
// // import { start } from '@saulx/selva-server'

test.serial('connection', async (t) => {
  const coreClient = new BasedCoreClient()

  const store = {
    hello: async ({ payload }) => {
      console.info(payload)
      return 'hello this is a repsonse...'
    },
  }

  createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 1e3,
      unregister: async (opts) => {
        console.info('unRegister', opts.name)
        return true
      },
      register: async ({ name }) => {
        console.info('name -->', name)
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

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

  const x = await coreClient.function('hello', {
    bla: true,
  })

  console.info(x)

  await wait(15e3)

  t.pass('yes')
})
