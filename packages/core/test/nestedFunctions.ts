import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/edge-server'
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
      importWrapperPath: join(__dirname, './functions/importWrapper.js'),
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
      // add name
      log: (log) => {
        console.info('-->', log.toString())
      },
      // add name
      error: (err) => {
        console.error('-->', err)
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

  let incomingCntNoJson = 0

  const close = coreClient.observe('obsWithNested', () => {
    incomingCntNoJson++
  })

  let incomingCnt = 0
  const close2 = coreClient.observe(
    'obsWithNested',
    () => {
      incomingCnt++
    },
    'json'
  )

  const bla = await coreClient.get('obsWithNested', 'json')

  t.is(bla.bla.length, 1e4)

  await wait(5e3)

  close()

  close2()

  t.true(incomingCnt > 50)
  t.true(incomingCntNoJson > 0)

  await wait(15e3)

  t.is(Object.keys(server.functions.functions).length, 0)
})