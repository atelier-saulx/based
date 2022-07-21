import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'
import { wait } from '@saulx/utils'

test.serial('functions', async (t) => {
  const coreClient = new BasedCoreClient()

  const store = {
    hello: async (payload) => {
      return payload.length
    },
    lotsOfData: async () => {
      console.info('hello lots of data')
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

  let str = ''
  for (let i = 0; i < 200000; i++) {
    str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
  }

  const helloResponses = await Promise.all([
    coreClient.function('hello', {
      bla: true,
    }),
    coreClient.function('hello', {
      bla: str,
    }),
  ])

  t.true(helloResponses[0] < 20)
  t.true(helloResponses[1] > 5e6)

  const bigString = await coreClient.function('lotsOfData')

  t.true(bigString.length > 5e6)

  await wait(3e3)

  t.is(Object.keys(server.functions.functions).length, 0)
})
