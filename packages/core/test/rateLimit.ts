import test from 'ava'
import createServer from '@based/edge-server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import { BasedCoreClient } from '../src/index'
import { join } from 'path'

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
      functionPath: join(__dirname, '/functions/hello.js'),
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
    },
  })

  const coreClient = new BasedCoreClient()

  let isLimit = false

  for (let i = 0; i < 2e3; i++) {
    const x = await fetch('http://localhost:9910/flap', {
      method: 'get',
      headers: {
        'content-type': 'application/json',
      },
    })
    if (x.status === 429) {
      console.info('bah ratelimit lets wait 30 seconds...')
      isLimit = true
      await wait(30e3)
    } else {
      console.info('Pass', i)
    }
  }

  // t.is(result, 'bla')

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const x = await coreClient.function('hello')

  t.true(!!x)

  t.true(isLimit, 'is rate Limited')

  await wait(10e3)

  t.is(Object.keys(server.functions.functions).length, 0)

  server.destroy()
})
