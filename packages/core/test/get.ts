import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/edge-server'
import { wait } from '@saulx/utils'
import { BasedError, BasedErrorCode } from '../src/types/error'
import { join } from 'path'

const setup = async () => {
  const coreClient = new BasedCoreClient()
  const obsStore = {
    counter: {
      name: 'counter',
      observable: true,
      checksum: 1,
      functionPath: join(__dirname, 'functions', 'counter.js'),
    },
    'counter-cached': {
      observable: true,
      name: 'counter-cached',
      checksum: 1,
      functionPath: join(__dirname, 'functions', 'counter.js'),
      memCacheTimeout: 1e3,
    },
  }
  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 0,
      idleTimeout: 1e3,
      route: ({ name }) => {
        if (name && obsStore[name]) {
          return obsStore[name]
        }
        return false
      },
      uninstall: async (opts) => {
        console.info('unRegister', opts.name)
        return true
      },
      install: async ({ name }) => {
        if (obsStore[name]) {
          return obsStore[name]
        } else {
          return false
        }
      },
    },
  })
  return { coreClient, server }
}

test.serial('get', async (t) => {
  const { coreClient, server } = await setup()

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
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

test.serial.only('authorize get', async (t) => {
  const { coreClient, server } = await setup()

  server.auth.updateConfig({
    authorizePath: join(__dirname, './functions/auth.js'),
  })

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const error: BasedError = await t.throwsAsync(coreClient.get('counter'))
  t.is(error.code, BasedErrorCode.AuthorizeRejectedError)

  await coreClient.auth('mock_token')
  await t.notThrowsAsync(coreClient.get('counter'))
})
