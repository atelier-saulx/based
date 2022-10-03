import test from 'ava'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
// import fetch from 'cross-fetch'
import { BasedCoreClient } from '../src/index'

test.serial('rate limit ws', async (t) => {
  const routes = {
    hello: {
      name: 'hello',
      path: '/flap',
    },
  }

  const functionSpecs = {
    hello: {
      checksum: 1,
      function: async () => {
        return 'bla'
      },
      ...routes.hello,
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 3e3,
      uninstall: async () => {
        await wait(1e3)
        return true
      },
      route: ({ path, name }) => {
        if (path) {
          for (const name in routes) {
            if (routes[name].path === path) {
              return routes[name]
            }
          }
        }
        if (name && routes[name]) {
          return routes[name]
        }
        return false
      },
      install: async ({ name }) => {
        if (functionSpecs[name]) {
          return functionSpecs[name]
        } else {
          return false
        }
      },
      log: (opts) => {
        console.info('-->', opts)
      },
    },
  })

  const coreClient = new BasedCoreClient()

  // const result = await (
  //   await fetch('http://localhost:9910/flap', {
  //     method: 'get',
  //     headers: {
  //       'content-type': 'application/json',
  //     },
  //   })
  // ).text()

  // for (i=0;i<10000) too many requests

  // t.is(result, 'bla')

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const x = await coreClient.function('hello')

  console.info('??', x)

  await wait(10e3)

  t.is(Object.keys(server.functions.functions).length, 0)

  server.destroy()
})
