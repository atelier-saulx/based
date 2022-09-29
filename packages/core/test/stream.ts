import test from 'ava'
import createServer from '@based/server'
import { wait } from '@saulx/utils'

test.serial('functions (over http + stream)', async (t) => {
  const routes = {
    hello: {
      name: 'hello',
      path: '/flap',
      stream: true,
    },
  }

  const functionSpecs = {
    hello: {
      checksum: 1,
      function: async (payload) => {
        if (payload) {
          return payload
        }
        return 'flap'
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
      route: async ({ path, name }) => {
        await wait(1e3)
        for (const name in routes) {
          if (routes[name].path === path) {
            return routes[name]
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

  t.is(Object.keys(server.functions.functions).length, 0)

  server.destroy()
})
