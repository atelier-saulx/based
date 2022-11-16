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
    obsWithNestedLvl2: {
      observable: true,
      name: 'obsWithNestedLvl2',
      checksum: 1,
      functionPath: join(__dirname, './functions/obsWithNestedLvl2.js'),
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      importWrapperPath: join(__dirname, './functions/importWrapper.js'),
      maxWorkers: 3,
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
          return { ...store[name] }
        } else {
          return false
        }
      },
    },
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const x = await coreClient.function('fnWithNested', { bla: true })

  t.is(x, '{"bla":true}')

  let cnt = 0

  const closeX = coreClient.observe('counter', () => {
    cnt++
  })

  await wait(500)

  t.true(cnt > 0)

  closeX()

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

  await wait(1e3)

  const bla = await coreClient.get('obsWithNested', 'json')

  t.is(bla.bla.length, 1e4)

  await wait(1e3)

  let incomingCnt2 = 0
  close()
  close2()

  console.info('CLOSED 1, 2, NOW LVL2')

  const close3 = coreClient.observe(
    'obsWithNestedLvl2',
    () => {
      incomingCnt2++
    },
    'glurk'
  )

  console.info('GET FROM LVL2')
  const bla2 = await coreClient.get('obsWithNestedLvl2', 'glakkel')

  t.is(bla2.bla.length, 1e4)

  await wait(1e3)

  close3()

  t.true(incomingCnt > 10)
  t.true(incomingCntNoJson > 0)
  t.true(incomingCnt2 > 10)

  await wait(15e3)

  t.is(Object.keys(server.functions.functions).length, 0)
})
