import test from 'ava'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import zlib from 'node:zlib'
import { join } from 'path'
import { promisify } from 'node:util'

const gzip = promisify(zlib.gzip)

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
      functionPath: join(__dirname, './functions/stream.js'),
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

  console.info('start!')

  const result = await (
    await fetch('http://localhost:9910/flap', {
      method: 'post',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(bigBod),
    })
  ).text()

  console.info(result)

  t.is(result, 'bla')

  const x = await gzip(JSON.stringify(bigBod))

  const resultBrotli = await (
    await fetch('http://localhost:9910/flap', {
      method: 'post',
      headers: {
        'content-encoding': 'gzip',
        'content-type': 'application/json',
      },
      body: x,
    })
  ).text()

  t.is(resultBrotli, 'bla')

  await wait(30e3)

  t.is(Object.keys(server.functions.functions).length, 0)

  server.destroy()
})
