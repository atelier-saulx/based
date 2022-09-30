import test from 'ava'
import createServer from '@based/server'
import { readStream, wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const deflate = promisify(zlib.deflate)
const gzip = promisify(zlib.gzip)
const br = promisify(zlib.brotliCompress)

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
      function: async ({ stream }) => {
        const buf = await readStream(stream)
        const x = JSON.parse(buf.toString())
        console.info(x)
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

  for (let i = 0; i < 1e6; i++) {
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
  ).json()

  console.info('yes -->', result)
  // t.deepEqual(bigBod, result)

  const x = await gzip(JSON.stringify(bigBod))

  console.log(x.length)

  const resultBrotli = await (
    await fetch('http://localhost:9910/flap', {
      method: 'post',
      headers: {
        'content-encoding': 'gzip',
        'content-type': 'application/json',
      },
      body: x,
    })
  ).json()

  console.log('durp', resultBrotli)

  // t.deepEqual(bigBod, resultBrotli)

  await wait(30e3)

  t.is(Object.keys(server.functions.functions).length, 0)

  server.destroy()
})
