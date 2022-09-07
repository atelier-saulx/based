import test, { ExecutionContext } from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'
import { BasedError, BasedErrorCode } from '../src/types/error'

const setup = async (t: ExecutionContext) => {
  t.timeout(4000)
  const coreClient = new BasedCoreClient()

  const store = {
    throwingFunction: async () => {
      throw new Error('This is error message')
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 3e3,
      unregister: async () => {
        return true
      },
      register: async ({ name }) => {
        if (store[name]) {
          return {
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
  t.is(error.basedCode, BasedErrorCode.FunctionError)
})
