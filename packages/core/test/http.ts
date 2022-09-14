import test from 'ava'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'

test.serial('functions (over http)', async (t) => {
  const store = {
    hello: {
      path: '/flap', // observables and functions will have a path configuration
      name: 'hello',
      checksum: 1,
      function: async (payload) => {
        console.info(payload)
        return payload?.length ?? 0
      },

      // customHttpRequest
      // get query prams -> payload
      // post DATA
      customHttpResponse: async (result, payload, client) => {
        const { res, isAborted, id } = client
        console.info('okidoki?', isAborted, id)

        if (isAborted) {
          return
        }
        res.writeStatus('200 OkiDoki')
        res.end('yesh ' + result)
        return true
      },
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 3e3,
      unregister: async () => {
        console.info('--- wait wait unreg')
        await wait(3e3)
        console.info('--- wait wait unreg DONE')
        console.info('UNREGISTERT...')
        return true
      },
      registerByPath: async ({ path }) => {
        console.info('--- wait wait path')
        await wait(1e3)
        console.info('--- wait wait  path')

        for (const name in store) {
          if (store[name].path === path) {
            return store[name]
          }
        }
        return false
      },
      register: async ({ name }) => {
        if (store[name]) {
          return store[name]
        } else {
          return false
        }
      },
      log: (opts) => {
        console.info('-->', opts)
      },
    },
  })

  console.info('START')
  const result = await (await fetch('http://localhost:9910/flap')).text()

  console.info(result)

  const result2 = await (
    await fetch('http://localhost:9910/flap?flurp=1')
  ).text()

  console.info('flap', result2)

  await wait(5e3)

  t.is(Object.keys(server.functions.functions).length, 0)
})
