import test from 'ava'
import createServer, {
  BasedFunctionSpec,
  BasedQueryFunctionSpec,
  BasedServer,
} from '@based/server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { encodeAuthState } from '../src/index'

const deflate = promisify(zlib.deflate)
const gzip = promisify(zlib.gzip)

test.serial('functions (custom headers)', async (t) => {
  const server = new BasedServer({
    port: 9910,
    functions: {
      specs: {
        hello: {
          uninstallAfterIdleTime: 1e3,
          headers: ['bla'],
          function: async (based, payload, ctx) => {
            return ctx.session?.headers.bla
          },
        },
      },
    },
  })
  await server.start()
  const x = await (
    await fetch('http://localhost:9910/hello', {
      headers: {
        bla: 'snurp',
      },
    })
  ).text()
  t.is(x, 'snurp')
  await server.destroy()
})

test.serial('functions (over http)', async (t) => {
  const store: {
    [key: string]: (BasedFunctionSpec | BasedQueryFunctionSpec) & {
      maxPayloadSize: number
      rateLimitTokens: 1
    }
  } = {
    hello: {
      path: '/flap',
      name: 'hello',
      maxPayloadSize: 1e6,
      rateLimitTokens: 1,
      checksum: 1,
      function: async (based, payload) => {
        if (payload) {
          return payload
        }
        return 'flap'
      },
      httpResponse: async (based, payload, responseData, send, ctx) => {
        if (!ctx.session) {
          return
        }
        const res = ctx.session.res
        res.writeStatus('200 OkiDoki')
        if (typeof responseData === 'object') {
          res.end(JSON.stringify(responseData))
          return
        }
        res.end('yesh ' + responseData)
      },
    },
  }

  const server = new BasedServer({
    port: 9910,
    functions: {
      uninstallAfterIdleTime: 1e3,
      closeAfterIdleTime: { query: 3e3, channel: 3e3 },
      route: ({ name, path }) => {
        if (path) {
          for (const name in store) {
            if (store[name].path === path) {
              return store[name]
            }
          }
        }
        if (name && store[name]) {
          return { name, maxPayloadSize: 1e6, rateLimitTokens: 1 }
        }
        return null
      },
      uninstall: async () => {
        await wait(1e3)
        return true
      },
      install: async ({ name }) => {
        if (store[name]) {
          return store[name]
        } else {
          return null
        }
      },
    },
  })
  await server.start()

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
    [key: string]: (BasedFunctionSpec | BasedQueryFunctionSpec) & {
      maxPayloadSize: number
      rateLimitTokens: 1
    }
  } = {
    hello: {
      path: '/counter',
      name: 'hello',
      maxPayloadSize: 1e6,
      rateLimitTokens: 1,
      closeAfterIdleTime: 3e3,
      uninstallAfterIdleTime: 1e3,
      checksum: 1,
      query: true,
      function: async (based, payload, update) => {
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
    obj: {
      path: '/obj',
      name: 'obj',
      maxPayloadSize: 1e6,
      rateLimitTokens: 1,
      checksum: 1,
      query: true,
      function: async (based, payload, update) => {
        // this breaks with native fetch only, and only when size > x
        update({
          bada: {
            bing: 'bada',
          },
          boomboom: {
            venga: 'venga',
          },
          lil: {
            wayoo: 'wicked',
          },
          wicked: {
            jungle: 'is-massive',
          },
          everybody: {
            leggo: 'shine',
          },
          time: {
            flip: 'flap',
          },
        })

        return () => {}
      },
    },
  }

  const server = new BasedServer({
    port: 9910,
    functions: {
      closeAfterIdleTime: { query: 3e3, channel: 3e3 },
      uninstallAfterIdleTime: 3e3,
      route: ({ name, path }) => {
        if (path) {
          for (const name in store) {
            if (store[name].path === path) {
              return store[name]
            }
          }
        }
        if (name && store[name]) {
          return store[name]
        }
        return null
      },
      uninstall: async () => {
        return true
      },
      install: async ({ name }) => {
        if (store[name]) {
          return store[name]
        } else {
          return null
        }
      },
    },
  })
  await server.start()

  const resultObj = await (await fetch('http://localhost:9910/obj')).json()

  t.is(typeof resultObj, 'object')

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
  const store: {
    [key: string]: (BasedFunctionSpec | BasedQueryFunctionSpec) & {
      maxPayloadSize: number
      rateLimitTokens: 1
    }
  } = {
    hello: {
      path: '/flap',
      name: 'hello',
      checksum: 1,
      maxPayloadSize: 1e11,
      rateLimitTokens: 1,
      function: async (based, payload) => {
        await wait(100)
        if (payload) {
          return payload
        }
        return 'flap'
      },
      httpResponse: async (based, payload, responseData, send, ctx) => {
        if (!ctx.session) {
          return
        }
        ctx.session.res.writeStatus('200 OkiDoki')
        if (typeof responseData === 'object') {
          ctx.session.res.end(JSON.stringify(responseData))
          return
        }
        ctx.session.res.end('yesh ' + responseData)
      },
    },
  }

  const server = new BasedServer({
    port: 9910,
    functions: {
      closeAfterIdleTime: { query: 3e3, channel: 3e3 },
      uninstallAfterIdleTime: 3e3,
      route: ({ name, path }) => {
        if (path) {
          for (const name in store) {
            if (store[name].path === path) {
              return store[name]
            }
          }
        }

        if (name && store[name]) {
          return store[name]
        }
        return null
      },

      uninstall: async () => {
        await wait(1e3)
        return true
      },

      install: async ({ name }) => {
        if (store[name]) {
          return store[name]
        } else {
          return null
        }
      },
    },
  })
  await server.start()

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

test.serial('auth', async (t) => {
  const server = new BasedServer({
    port: 9910,
    functions: {
      specs: {
        flap: {
          uninstallAfterIdleTime: 1e3,
          function: async () => {
            return 'hello this is fun!!!'
          },
        },
      },
    },
    auth: {
      authorize: async (based, context) => {
        if (context.session?.authState.token === 'bla') {
          return true
        }
        return false
      },
    },
  })
  await server.start()

  const r1 = await (
    await fetch('http://localhost:9910/flap', {
      method: 'post',
      headers: {
        // allways token ?
        authorization: encodeAuthState({ token: 'snurp' }),
      },
    })
  ).json()

  t.is(r1.code, 40301)

  const r = await (
    await fetch('http://localhost:9910/flap', {
      method: 'post',
      headers: {
        authorization: encodeAuthState({ token: 'bla' }),
      },
    })
  ).text()

  t.is(r, 'hello this is fun!!!')

  await wait(10e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})
