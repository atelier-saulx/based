import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
import { join } from 'path'

test.serial('nested functions', async (t) => {
  const coreClient = new BasedCoreClient()

  const store = {
    hello: {
      name: 'hello',
      checksum: 1,
      functionPath: join(__dirname, 'functions', 'hello.js'),
    },
    nested: {
      name: 'nested',
      checksum: 1,
      functionPath: join(__dirname, 'functions', 'helloNested.js'),
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      maxWorkers: 2,
      memCacheTimeout: 3e3,
      idleTimeout: 3e3,
      route: ({ name }) => {
        if (name && store[name]) {
          return {
            name,
            maxPayloadSize: 1e6 * 10,
          }
        }
        return false
      },
      uninstall: async () => {
        await wait(1e3)
        return true
      },
      install: async ({ name }) => {
        if (store[name]) {
          return store[name]
        } else {
          return false
        }
      },
      log: (opts) => {
        console.info('-->', opts)
      },
    },
  })

  server.on('error', console.error)

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('??? connect --->', isConnected)
  })

  const x = await coreClient.function('hello', { bla: true })

  console.info('FN RESPONSE -->', x)

  await wait(15e3)

  t.is(Object.keys(server.functions.functions).length, 0)
})
