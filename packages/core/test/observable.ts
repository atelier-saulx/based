import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'
import { wait } from '@saulx/utils'

test.serial('observables', async (t) => {
  const coreClient = new BasedCoreClient()

  const store = {
    // hello: async (payload) => {
    //   return payload.length
    // },
    // lotsOfData: async () => {
    //   let str = ''
    //   for (let i = 0; i < 200000; i++) {
    //     str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
    //   }
    //   return str
    // },
  }

  const server = await createServer({
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

  const close = coreClient.observe('counter', (d) => console.info(d), {
    myQuery: 123,
  })

  await wait(3e3)

  close()

  t.pass()

  // t.is(Object.keys(server.functions.functions).length, 0)
})
