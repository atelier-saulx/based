import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/edge-server'
import { BasedError, BasedErrorCode } from '../src/types/error'
import { wait } from '@saulx/utils'
import { join } from 'path'

const setup = async () => {
  const coreClient = new BasedCoreClient()

  const store = {
    hello: {
      observable: false,
      functionPath: join(__dirname, '/functions/hello'),
    },
    counter: {
      observable: true,
      functionPath: join(__dirname, '/functions/counter'),
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 3e3,
      route: ({ name }) => {
        if (name && store[name]) {
          return {
            name,
            observable: store[name].observable,
          }
        }
        return false
      },
      uninstall: async () => {
        return true
      },
      install: async ({ name }) => {
        if (store[name]) {
          return {
            name,
            checksum: 1,
            ...store[name],
          }
        } else {
          return false
        }
      },
    },
  })
  return { coreClient, server }
}

test.serial('authorize functions', async (t) => {
  t.timeout(1000)

  const token = 'mock_token'

  const { coreClient, server } = await setup()

  server.auth.updateConfig({
    authorizePath: join(__dirname, 'functions', 'auth.js'),
  })

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await t.throwsAsync(
    coreClient.function('hello', {
      bla: true,
    })
  )
  await coreClient.auth(token)
  await t.notThrowsAsync(
    coreClient.function('hello', {
      bla: true,
    })
  )
})

test.serial('authorize observe', async (t) => {
  t.timeout(12000)

  const token = 'mock_token'

  const { coreClient, server } = await setup()

  let counter: NodeJS.Timer

  server.functions.update({
    observable: true,
    name: 'counter',
    checksum: 2,
    functionPath: join(__dirname, 'functions', 'counter.js'),
  })

  server.auth.updateConfig({
    authorizePath: join(__dirname, 'functions', 'auth.js'),
  })

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await new Promise((resolve) => {
    coreClient.observe(
      'counter',
      () => {
        // console.info({ d })
      },
      {
        myQuery: 123,
      },
      (err: BasedError) => {
        t.is(err.code, BasedErrorCode.AuthorizeRejectedError)
        resolve(err)
      }
    )
  })

  await coreClient.auth(token)
  await wait(500)

  await new Promise((resolve) => {
    coreClient.observe(
      'counter',
      (d) => {
        resolve(d)
      },
      {
        myQuery: 123,
      },
      (err: BasedError) => {
        t.fail('Should not error when authed')
        resolve(err)
      }
    )
  })

  // @ts-ignore - totally incorrect typescript error...
  clearInterval(counter)
})

test.serial('authorize after observe', async (t) => {
  t.timeout(12000)

  const token = 'mock_token'

  const { coreClient, server } = await setup()
  let counter: NodeJS.Timer

  server.functions.update({
    observable: true,
    name: 'counter',
    checksum: 2,
    functionPath: join(__dirname, 'functions', 'counter.js'),
  })

  server.auth.updateConfig({
    authorizePath: join(__dirname, 'functions', 'auth.js'),
  })

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })
  await wait(500)

  let receiveCnt = 0

  coreClient.observe(
    'counter',
    () => {
      receiveCnt++
    },
    {
      myQuery: 123,
    },
    (err: BasedError) => {
      t.is(err.code, BasedErrorCode.AuthorizeRejectedError)
    }
  )

  await wait(500)
  t.is(receiveCnt, 0)
  await coreClient.auth(token)
  await wait(500)

  // @ts-ignore - totally incorrect typescript error...
  clearInterval(counter)

  t.true(receiveCnt > 0)
})
