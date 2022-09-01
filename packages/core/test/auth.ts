import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer from '@based/server'

test.serial('auth', async (t) => {
  t.timeout(4000)
  const coreClient = new BasedCoreClient()

  const store = {
    hello: async (payload: any) => {
      return payload.length
    },
    lotsOfData: async () => {
      let str = ''
      for (let i = 0; i < 200000; i++) {
        str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
      }
      return str
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

  coreClient.once('connect', () => {
    console.info('connect')
  })
  coreClient.once('disconnect', (isConnected) => {
    console.info('disconnect')
  })

  coreClient.once('auth', (authData) => {
    console.info('auth', { authData })
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const token = 'mock_token'
  const result = await coreClient.auth(token)
  t.true(result)
  t.is(coreClient.authState.token, token)
  // t.false(coreClient.authInProgress)

  // console.log(
  //   'hello',
  //   await coreClient.function('hello', {
  //     bla: true,
  //   })
  // )
})
