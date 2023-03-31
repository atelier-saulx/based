import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'
import { BasedError, BasedErrorCode } from '../src/types/error'
import { BasedQueryFunction, ObservableUpdateFunction } from '@based/functions'

const throwingFunction = async () => {
  throw new Error('This is error message')
}

const counter: BasedQueryFunction = (based, payload, update) => {
  update({ yeye: 'yeye' })
  throw new Error('bla')
  return () => undefined
}

const errorFunction = async () => {
  const wawa = [1, 2]
  // @ts-ignore
  return wawa[3].yeye
}

const errorTimer = (based, payload, update: ObservableUpdateFunction) => {
  const int = setInterval(() => {
    update(undefined, undefined, new Error('lol'))
  }, 10)
  update('yes')
  return () => {
    clearInterval(int)
  }
}

const setup = async (t: ExecutionContext) => {
  t.timeout(4000)
  const coreClient = new BasedClient()

  const server = new BasedServer({
    port: 9910,
    functions: {
      specs: {
        throwingFunction: {
          uninstallAfterIdleTime: 1e3,
          function: throwingFunction,
        },
        errorFunction: {
          uninstallAfterIdleTime: 1e3,
          function: errorFunction,
        },
        counter: {
          query: true,
          uninstallAfterIdleTime: 1e3,
          function: counter,
        },
        errorTimer: {
          query: true,
          uninstallAfterIdleTime: 1e3,
          function: errorTimer,
        },
      },
    },
  })
  await server.start()

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
    coreClient.query('counter', {}).subscribe(
      (v) => {
        console.info({ v })
      },

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
test.serial('throw in an interval', async (t) => {
  const { coreClient } = await setup(t)
  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })
  await t.throwsAsync(
    new Promise((resolve, reject) =>
      coreClient.query('errorTimer', {}).subscribe(() => {}, reject)
    )
  )
})
