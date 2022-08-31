import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'
import { wait } from '@saulx/utils'

test.serial('observables', async (t) => {
  const coreClient = new BasedCoreClient()

  const obsStore = {
    counter: async (payload, update) => {
      let cnt = 0
      const counter = setInterval(() => {
        update(++cnt)
      }, 100)
      return () => {
        clearInterval(counter)
      }
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

  const obs1Results: any[] = []
  const obs2Results: any[] = []

  const close = coreClient.observe(
    'counter',
    (d) => {
      obs1Results.push(d)
      console.info('👻', d)
    },
    {
      myQuery: 123,
    }
  )

  const close2 = coreClient.observe(
    'counter',
    (d) => {
      obs2Results.push(d)
      console.info('🌈', d)
    },
    {
      myQuery: 123,
    }
  )

  await wait(500)

  close()

  server.functions.update({
    observable: true,
    name: 'counter',
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

  await wait(3e3)

  close2()

  t.true(obs1Results.length < obs2Results.length)

  t.true(typeof obs2Results[obs2Results.length - 1] === 'string')

  t.pass()

  // t.is(Object.keys(server.functions.functions).length, 0)
})
