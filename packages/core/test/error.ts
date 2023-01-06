import test, { ExecutionContext } from 'ava'
import { BasedCoreClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { BasedError, BasedErrorCode } from '../src/types/error'

const throwingFunction = async () => {
  console.info('snurp?')
  throw new Error('This is error message')
}

const counter = (_payload, update) => {
  return update({ yeye: 'yeye' })
}

const errorFunction = async () => {
  const wawa = [1, 2]
  // @ts-ignore
  return wawa[3].yeye
}

const errorTimer = (module.exports = (payload, update) => {
  setInterval(() => {
    throw new Error('lol')
  }, 10)
  return update('yes')
})

const setup = async (t: ExecutionContext) => {
  t.timeout(4000)
  const coreClient = new BasedCoreClient()

  const server = await createSimpleServer({
    port: 9910,
    functions: {
      throwingFunction,
      errorFunction,
    },
    observables: {
      counter,
      errorTimer,
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
    coreClient.call('throwingFunction')
  )) as BasedError

  t.is(error.code, BasedErrorCode.FunctionError)
})

test.serial('function authorize error', async (t) => {
  const { coreClient, server } = await setup(t)

  server.auth.updateConfig({
    authorize: throwingFunction,
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
    authorize: throwingFunction,
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

// TODO: Will be handled by transpilation of the function (wrapping set inerval / timeout)
test.serial.skip('throw in an interval', async (t) => {
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
