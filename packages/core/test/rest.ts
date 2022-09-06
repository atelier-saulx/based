import test from 'ava'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
// import fetch from 'cross-fetch'

test.serial('functions (over rest)', async (t) => {
  const store = {
    hello: {
      path: '/flap', // observables and functions will have a path configuration
      name: 'hello',
      checksum: 1,
      function: async (payload) => {
        return payload.length
      },
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

  let str = ''
  for (let i = 0; i < 200000; i++) {
    str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
  }

  //   const helloResponses = await Promise.all([
  //     fetch(('hello', {
  //       bla: true,
  //     })),
  //     fetch(function('hello', {
  //       bla: str,
  //     )
  //   ])

  //   t.true(helloResponses[0] < 20)
  //   t.true(helloResponses[1] > 5e6)

  //   const bigString = await coreClient.function('lotsOfData')

  //   t.true(bigString.length > 5e6)

  await wait(3e3)

  t.is(Object.keys(server.functions.functions).length, 0)
})
