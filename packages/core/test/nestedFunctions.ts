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
    fnWithNested: {
      name: 'fnWithNested',
      checksum: 1,
      functionPath: join(__dirname, 'functions', 'fnWithNested.js'),
    },
    counter: {
      observable: true,
      name: 'counter',
      checksum: 1,
      functionPath: join(__dirname, './functions/counter.js'),
    },
    objectCounter: {
      observable: true,
      name: 'objectCounter',
      checksum: 1,
      functionPath: join(__dirname, './functions/objectCounter.js'),
    },
    obsWithNested: {
      observable: true,
      name: 'obsWithNested',
      checksum: 1,
      functionPath: join(__dirname, './functions/obsWithNested.js'),
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      functionApiWrapperPath: join(__dirname, 'functions', 'fnWrapper.js'),
      maxWorkers: 16,
      memCacheTimeout: 3e3,
      idleTimeout: 3e3,
      route: ({ name }) => {
        if (name && store[name]) {
          return {
            ...store[name],
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

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const x = await coreClient.function('fnWithNested', { bla: true })

  t.is(x, 12)

  const close = coreClient.observe('obsWithNested', (data) => {
    console.info('X????', data)
  })

  const close2 = coreClient.observe(
    'obsWithNested',
    (data, checksum) => {
      console.info('NR 2 incoming!', data.bla.length, checksum)
    },
    'json'
  )

  await wait(5e3)

  close()

  close2()

  await wait(15e3)

  t.is(Object.keys(server.functions.functions).length, 0)
})
