import test from 'ava'
import createServer from '@based/edge-server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { join } from 'node:path'

const deflate = promisify(zlib.deflate)
const gzip = promisify(zlib.gzip)

test.serial('functions (over http)', async (t) => {
  const store = {
    hello: {
      path: '/flap',
      name: 'hello',
      checksum: 1,
      functionPath: join(__dirname, 'functions', 'hello.js'),

      // TODO: FIX THIS
      customHttpResponse: async (result, payload, client) => {
        const { res, isAborted } = client
        if (isAborted) {
          return
        }
        // just make a return thing
        // { headers: {} , status: , reply }
        // send() can be wrapped in the based fn header

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
      idleTimeout: 3e3,

      route: ({ name, path }) => {
        if (path) {
          for (const name in store) {
            if (store[name].path === path) {
              return {
                name: store[name].name,
                observable: store[name].observable,
              }
            }
          }
        }

        if (name && store[name]) {
          return { name }
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
      body: JSON.stringify({ flurp: 1 }),
    })
  ).text()

  t.is(result3, '{"flurp":1}')

  const x = await (await fetch('http://localhost:9910/gurk')).text()

  t.is(x, `'{"error":"Function not found 'gurk'","code":40401}`)

  await wait(10e3)

  t.is(Object.keys(server.functions.functions).length, 0)

  server.destroy()
})

test.serial.only('get (over http)', async (t) => {
  const store = {
    hello: {
      path: '/counter',
      name: 'hello',
      checksum: 1,
      observable: true,
      functionPath: join(__dirname, 'functions', 'counter.js'),
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
              }
            }
          }
        }

        if (name && store[name]) {
          return { name, observable: store[name].observable }
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

  t.is(Object.keys(server.functions.observables).length, 0)

  server.destroy()
})

test.serial('functions (over http + contentEncoding)', async (t) => {
  const store = {
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
      customHttpResponse: async (result, payload, client) => {
        const { res, isAborted } = client
        if (isAborted) {
          return
        }
        // just make a return thing
        // { headers: {} , status: , reply }
        // send() can be wrapped in the based fn header

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
      idleTimeout: 3e3,

      route: ({ name, path }) => {
        if (path) {
          for (const name in store) {
            if (store[name].path === path) {
              return {
                maxPayloadSize: 1e11,
                name: store[name].name,
                observable: store[name].observable,
              }
            }
          }
        }

        if (name && store[name]) {
          return { name }
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

  t.is(Object.keys(server.functions.functions).length, 0)

  server.destroy()
})

// TODO: add auth test
