import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'
import { wait } from '@saulx/utils'

test.serial('get', async (t) => {
  const coreClient = new BasedCoreClient()

  const obsStore = {
    counter: async (payload, update) => {
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
      unregister: async (opts) => {
        console.info('unRegister', opts.name)
        return true
      },
      register: async ({ name }) => {
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
