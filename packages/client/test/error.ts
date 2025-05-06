import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { BasedError, BasedErrorCode } from '@based/errors'
import { BasedQueryFunction, ObservableUpdateFunction } from '@based/functions'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

const throwingFunction = async () => {
  throw new Error('This is error message')
}

const counter: BasedQueryFunction = (_, __, update) => {
  update({ yeye: 'yeye' })
  throw new Error('bla')
  // return () => undefined
}

const errorFunction = async () => {
  const wawa = [1, 2]
  // @ts-ignore
  return wawa[3].yeye
}

const errorTimer = (_: any, __: any, update: ObservableUpdateFunction) => {
  const int = setInterval(() => {
    update(undefined, undefined, new Error('lol'))
  }, 10)
  update('yes')
  return () => {
    clearInterval(int)
  }
}

const setup = async (t: T) => {
  t.timeout(4000)
  const coreClient = new BasedClient()

  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: {
        throwingFunction: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: throwingFunction,
        },
        errorFunction: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: errorFunction,
        },
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: counter,
        },
        errorTimer: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: errorTimer,
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

test('function error', async (t: T) => {
  const { coreClient } = await setup(t)

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  // TODO: Check error instance of
  const error = (await t.throwsAsync(
    coreClient.call('throwingFunction'),
  )) as BasedError

  t.is(error.code, BasedErrorCode.FunctionError)
})

test('function authorize error', async (t: T) => {
  const { coreClient, server } = await setup(t)

  server.auth.updateConfig({
    authorize: throwingFunction,
  })

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  // TODO: Check error instance of
  const error = (await t.throwsAsync(
    coreClient.call('throwingFunction'),
  )) as BasedError
  t.is(error.code, BasedErrorCode.AuthorizeFunctionError)
})

test('observable authorize error', async (t: T) => {
  const { coreClient, server } = await setup(t)

  server.auth.updateConfig({
    authorize: throwingFunction,
  })

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  // TODO: Check error instance of
  const error = (await new Promise((resolve) => {
    coreClient.query('counter', {}).subscribe(
      (v) => {},

      (err) => {
        resolve(err)
      },
    )
  })) as BasedError
  t.is(error.code, BasedErrorCode.AuthorizeFunctionError)
})

test('type error in function', async (t: T) => {
  const { coreClient } = await setup(t)

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  // TODO: Check error instance of
  const error = (await t.throwsAsync(
    coreClient.call('errorFunction'),
  )) as BasedError
  t.is(error.code, BasedErrorCode.FunctionError)
})

// TODO: Will be handled by transpilation of the function (wrapping set inerval / timeout)
test('throw in an interval', async (t: T) => {
  const { coreClient } = await setup(t)
  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })
  await t.throwsAsync(
    new Promise((_, reject) =>
      coreClient.query('errorTimer', {}).subscribe(() => {}, reject),
    ),
  )
})
