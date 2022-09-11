import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'
import { wait } from '@saulx/utils'

test.serial('get', async (t) => {
  const store = {
    hello: {
      observable: true,
      name: 'hello',
      checksum: 1,
      function: async () => {
        return 'hello'
      },
    },
  }

  await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 0,
      idleTimeout: 1e3,
      unregister: async (opts) => {
        console.info('unRegister', opts.name)
        return true
      },
      register: async ({ name }) => {
        if (store[name]) {
          return store[name]
        } else {
          return false
        }
      },
      log: () => {
        // console.info('-->', opts)
      },
    },
  })

  const cl: Set<BasedCoreClient> = new Set()

  for (let i = 0; i < 100; i++) {
    const client = new BasedCoreClient()
    client.connect({
      url: async () => {
        return 'ws://localhost:9910'
      },
    })
    cl.add(client)
  }

  await wait(2000)

  const used1 = process.memoryUsage().heapUsed / 1024 / 1024
  console.info(
    `Mem before disconnect approximately ${Math.round(used1 * 100) / 100} MB`
  )

  for (const client of cl) {
    client.disconnect()
    cl.delete(client)
  }

  await wait(10000)

  const used2 = process.memoryUsage().heapUsed / 1024 / 1024
  console.info(
    `Mem after disconnect approximately ${Math.round(used2 * 100) / 100} MB`
  )

  t.true(used2 < 160, 'Does not use too much mem')
})
