import test, { ExecutionContext } from 'ava'
import { BasedCoreClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { BasedError, BasedErrorCode } from '../src/types/error'
import { join } from 'path'

const setup = async (t: ExecutionContext) => {
  t.timeout(4000)
  const coreClient = new BasedCoreClient()

  const store = {
    throwingFunction: join(__dirname, '/functions/throwingFunctions.js'),
    counter: join(__dirname, '/functions/counterYe.js'),
    errorFunction: join(__dirname, '/functions/errorFunction.js'),
    errorTimer: join(__dirname, '/functions/errorTimer.js'),
  }

  const server = await createSimpleServer({
    port: 9910,
    functions: {},
    observables: {},
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
    coreClient.call('throwingFunction')
  )) as BasedError
  t.is(error.code, BasedErrorCode.FunctionError)
})

test.serial('function authorize error', async (t) => {
  const { coreClient, server } = await setup(t)

  server.auth.updateConfig({
    authorizePath: join(__dirname, './functions/throwingFunction.js'),
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  // TODO: Check error instance of
  const error = (await t.throwsAsync(
    coreClient.call('throwingFunction')
  )) as BasedError
  t.is(error.code, BasedErrorCode.AuthorizeFunctionError)
})

test.serial('observable authorize error', async (t) => {
  const { coreClient, server } = await setup(t)

  server.auth.updateConfig({
    authorizePath: join(__dirname, './functions/throwingFunction.js'),
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
    coreClient.call('errorFunction')
  )) as BasedError
  t.is(error.code, BasedErrorCode.FunctionError)
})

// TODO: NEEDS TO BE FIXED
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
