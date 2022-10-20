import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
import { join } from 'path'

test.serial('functions', async (t) => {
  const coreClient = new BasedCoreClient()

  const store = {
    hello: {
      name: 'hello',
      checksum: 1,
      functionPath: join(__dirname, 'functions', 'hello.js'),
    },
    lotsOfData: {
      name: 'lotsOfData',
      checksum: 1,
      functionPath: join(__dirname, 'functions', 'lotsOfData.js'),
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      maxWorkers: 16,
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
    console.info('connect', isConnected)
  })

  const helloResponsesX = await Promise.all([
    coreClient.function('hello', {
      bla: true,
    }),
    coreClient.function('hello', {
      bla: true,
    }),
    coreClient.function('hello', {
      bla: true,
    }),
  ])

  t.true(helloResponsesX[0] < 20)

  t.deepEqual(helloResponsesX[0], helloResponsesX[1])
  t.deepEqual(helloResponsesX[1], helloResponsesX[2])

  let str = ''
  for (let i = 0; i < 2000000; i++) {
    str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
  }

  // max size is 10mb (compressed) so this is close (50mb uncompressed)
  console.info('Send:', ~~((str.length / 1024 / 1024) * 100) / 100, 'mb')

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

  await wait(15e3)

  t.is(Object.keys(server.functions.functions).length, 0)
})
