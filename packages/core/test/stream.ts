import test from 'ava'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'

// contentEncoding will be respected
// const deflate = promisify(zlib.deflate)
// const gzip = promisify(zlib.gzip)
// const br = promisify(zlib.brotliCompress)

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
      function: async ({ stream, client }) => {
        console.info('STREAM coming', client)
        stream.on('data', (c) => {
          console.info(c)
        })
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

  const bigBod: any[] = []

  for (let i = 0; i < 10000; i++) {
    bigBod.push({ flap: 'snurp', i })
  }

  const result = await (
    await fetch('http://localhost:9910/flap', {
      method: 'post',
      headers: {
        // 'content-encoding': 'br',
        'content-type': 'application/json',
      },
      body: JSON.stringify(bigBod),
    })
  ).text()

  console.info(result)

  await wait(10e3)

  t.is(Object.keys(server.functions.functions).length, 0)

  server.destroy()
})
