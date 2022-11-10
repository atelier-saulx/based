import test, { ExecutionContext } from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/edge-server'
import { BasedError, BasedErrorCode } from '../src/types/error'

const setup = async (t: ExecutionContext) => {
  t.timeout(4000)
  const coreClient = new BasedCoreClient()

  const store = {
    throwingFunction: async () => {
      throw new Error('This is error message')
    },
    counter: async (_payload, update) => {
      update({ yeye: 'yeye' })
    },
    errorFunction: async () => {
      const wawa = [1, 2]
      // @ts-ignore
      return wawa[3].yeye
    },
    errorTimer: async (payload, update) => {
      setInterval(() => {
        throw new Error('lol')
      }, 10)
      update('yes')
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
            observable: name === 'counter' || name === 'errorTimer',
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
            observable: name === 'counter' || name === 'errorTimer',
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

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  return { coreClient, server }
}

test.serial('function error', async (t) => {
  const { coreClient } = await setup(t)

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  // TODO: Check error instance of
  const error = (await t.throwsAsync(
    coreClient.function('throwingFunction')
  )) as BasedError
  t.is(error.code, BasedErrorCode.FunctionError)
})

test.serial('function authorize error', async (t) => {
  const { coreClient, server } = await setup(t)

  server.auth.updateConfig({
    authorize: async () => {
      throw new Error('Error inside authorize')
    },
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  // TODO: Check error instance of
  const error = (await t.throwsAsync(
    coreClient.function('throwingFunction')
  )) as BasedError
  t.is(error.code, BasedErrorCode.AuthorizeFunctionError)
})

test.serial('observable authorize error', async (t) => {
  const { coreClient, server } = await setup(t)

  server.auth.updateConfig({
    authorize: async () => {
      throw new Error('Error inside authorize')
    },
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  // TODO: Check error instance of
  const error = (await new Promise((resolve) => {
    coreClient.observe(
      'counter',
      (v) => {
        console.info({ v })
      },
      {},
      (err) => {
        resolve(err)
      }
    )
  })) as BasedError
  t.is(error.code, BasedErrorCode.AuthorizeFunctionError)
})

test.serial('type error in function', async (t) => {
  const { coreClient } = await setup(t)

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  // TODO: Check error instance of
  const error = (await t.throwsAsync(
    coreClient.function('errorFunction')
  )) as BasedError
  t.is(error.code, BasedErrorCode.FunctionError)
})

test.serial('throw in an interval', async (t) => {
  const { coreClient } = await setup(t)
  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })
  await t.throwsAsync(
    new Promise((resolve, reject) =>
      coreClient.observe('errorTimer', console.info, {}, reject)
    )
  )
})
