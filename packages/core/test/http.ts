import test from 'ava'
import createServer, {
  BasedFunctionSpec,
  BasedObservableFunctionSpec,
} from '@based/server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const deflate = promisify(zlib.deflate)
const gzip = promisify(zlib.gzip)

test.serial.only('functions (over http)', async (t) => {
  const store: {
    [key: string]: BasedFunctionSpec | BasedObservableFunctionSpec
  } = {
    hello: {
      path: '/flap',
      name: 'hello',
      checksum: 1,
      function: async (payload) => {
        if (payload) {
          return payload
        }
        return 'flap'
      },
      customHttpResponse: async (result, payload, context) => {
        if (!context.session) {
          return false
        }
        const res = context.session.res
        res.writeStatus('200 OkiDoki')
        if (typeof result === 'object') {
          res.end(JSON.stringify(result))
          return true
        }
        res.end('yesh ' + result)
        return true
      },
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 1e3,
      route: ({ name, path }) => {
        if (path) {
          for (const name in store) {
            if (store[name].path === path) {
              return {
                name: store[name].name,
                observable: store[name].observable,
                maxPayloadSize: 1e6,
                rateLimitTokens: 1,
              }
            }
          }
        }
        if (name && store[name]) {
          return { name, maxPayloadSize: 1e6, rateLimitTokens: 1 }
        }
        return false
      },
      uninstall: async () => {
        await wait(1e3)
        return true
      },
      install: async ({ name }) => {
        if (store[name]) {
          return store[name]
        } else {
          return false
        }
      },
    },
  })

  const result = await (await fetch('http://localhost:9910/flap')).text()

  t.is(result, 'yesh flap')

  const result2 = await (
    await fetch('http://localhost:9910/flap?flurp=1')
  ).text()

  t.is(result2, '{"flurp":1}')

  const result3 = await (
    await fetch('http://localhost:9910/flap', {
      method: 'post',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ flurp: 2 }),
    })
  ).text()

  t.is(result3, '{"flurp":2}')

  const x = await (await fetch('http://localhost:9910/gurk')).text()

  t.is(x, `{"error":"[gurk] Function not found","code":40401}`)

  await wait(10e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})

test.serial('get (over http)', async (t) => {
  const store: {
    [key: string]: BasedFunctionSpec | BasedObservableFunctionSpec
  } = {
    hello: {
      path: '/counter',
      name: 'hello',
      checksum: 1,
      observable: true,
      function: async (_payload, update) => {
        let cnt = 0
        update(cnt)
        const counter = setInterval(() => {
          update(++cnt)
        }, 1000)
        return () => {
          clearInterval(counter)
        }
      },
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 3e3,
      route: ({ name, path }) => {
        if (path) {
          for (const name in store) {
            if (store[name].path === path) {
              return {
                name: store[name].name,
                observable: store[name].observable,
                maxPayloadSize: 1e6,
                rateLimitTokens: 1,
              }
            }
          }
        }
        if (name && store[name]) {
          return {
            name,
            observable: store[name].observable,
            maxPayloadSize: 1e6,
            rateLimitTokens: 1,
          }
        }
        return false
      },
      uninstall: async () => {
        return true
      },
      install: async ({ name }) => {
        if (store[name]) {
          return store[name]
        } else {
          return false
        }
      },
    },
  })

  const result = await (await fetch('http://localhost:9910/counter')).text()

  t.is(result, '0')

  await wait(1e3)

  const result2 = await (await fetch('http://localhost:9910/counter')).text()

  t.is(result2, '1')

  await wait(1e3)

  const result3 = await (await fetch('http://localhost:9910/hello')).text()

  t.is(result3, '2')

  await wait(10e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})

test.serial('functions (over http + contentEncoding)', async (t) => {
  const store: { [key: string]: BasedFunctionSpec } = {
    hello: {
      path: '/flap',
      name: 'hello',
      checksum: 1,
      function: async (payload) => {
        await wait(100)
        if (payload) {
          return payload
        }
        return 'flap'
      },
      customHttpResponse: async (result, payload, context) => {
        if (!context.session) {
          return false
        }
        context.session.res.writeStatus('200 OkiDoki')
        if (typeof result === 'object') {
          context.session.res.end(JSON.stringify(result))
          return true
        }
        context.session.res.end('yesh ' + result)
        return true
      },
    },
  }

  const server = await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 3e3,

      route: ({ name, path }) => {
        if (path) {
          for (const name in store) {
            if (store[name].path === path) {
              return {
                maxPayloadSize: 1e11,
                name: store[name].name,
                observable: store[name].observable,
                rateLimitTokens: 1,
              }
            }
          }
        }

        if (name && store[name]) {
          return {
            name,
            maxPayloadSize: 1e11,
            rateLimitTokens: 1,
          }
        }
        return false
      },

      uninstall: async () => {
        await wait(1e3)
        return true
      },

      install: async ({ name }) => {
        if (store[name]) {
          return store[name]
        } else {
          return false
        }
      },
    },
  })

  const result1 = await (
    await fetch('http://localhost:9910/flap', {
      method: 'post',
      headers: {
        'content-encoding': 'deflate',
        'content-type': 'application/json',
      },
      body: await deflate(JSON.stringify({ flurp: 1 })),
    })
  ).text()

  t.is(result1, '{"flurp":1}')

  const result2 = await (
    await fetch('http://localhost:9910/flap', {
      method: 'post',
      headers: {
        'content-encoding': 'gzip',
        'content-type': 'application/json',
      },
      body: await gzip(JSON.stringify({ flurp: 2 })),
    })
  ).text()

  t.is(result2, '{"flurp":2}')

  const bigBod: any[] = []

  for (let i = 0; i < 1e6; i++) {
    bigBod.push({ flap: 'snurp', i })
  }

  const result3 = await (
    await fetch('http://localhost:9910/flap', {
      method: 'post',

      headers: {
        'content-encoding': 'gzip',
        'content-type': 'application/json',
      },
      body: await gzip(JSON.stringify(bigBod)),
    })
  ).json()

  t.deepEqual(result3, bigBod)

  await wait(10e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})

// TODO: add auth test
