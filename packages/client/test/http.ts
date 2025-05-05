import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { encodeAuthState } from '../src/index.js'
import { BasedFunctionConfigComplete, isHttpContext } from '@based/functions'
import getPort from 'get-port'
import querystring from 'node:querystring'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

const deflate = promisify(zlib.deflate)
const gzip = promisify(zlib.gzip)

test.serial('functions (session url)', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: {
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          headers: ['bla'],
          fn: async (_, __, ctx) => {
            if (isHttpContext(ctx)) {
              return ctx.session?.url
            }
          },
        },
      },
    },
  })
  await server.start()
  const url = await (await fetch(t.context.http + '/hello')).text()
  t.is(url, '/hello')
  await server.destroy()
})

test.serial('functions (custom headers)', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: {
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          headers: ['bla'],
          fn: async (_, __, ctx) => {
            return ctx.session?.headers.bla
          },
        },
      },
    },
  })
  await server.start()
  const x = await (
    await fetch(t.context.http + '/hello', {
      headers: {
        bla: 'snurp',
      },
    })
  ).text()
  t.is(x, 'snurp')
  await server.destroy()
})

test.serial('functions (over http)', async (t: T) => {
  const store: {
    [key: string]: BasedFunctionConfigComplete
  } = {
    hello: {
      type: 'function',
      path: '/flap',
      name: 'hello',
      maxPayloadSize: 1e6,
      rateLimitTokens: 1,
      version: 1,
      fn: async (_, payload) => {
        if (payload) {
          return payload
        }
        return 'flap'
      },
      httpResponse: async (_, __, responseData, ___, ctx) => {
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
    port: t.context.port,
    silent: true,
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
          return {
            type: store[name].type,
            name,
            maxPayloadSize: 1e6,
            rateLimitTokens: 1,
          }
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

  const result = await (await fetch(t.context.http + '/flap')).text()

  t.is(result, 'yesh flap')

  const result2 = await (await fetch(t.context.http + '/flap?flurp=1')).text()

  t.is(result2, '{"flurp":1}')

  const result3 = await (
    await fetch(t.context.http + '/flap', {
      method: 'post',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ flurp: 2 }),
    })
  ).text()

  t.is(result3, '{"flurp":2}')

  const x = await (await fetch(t.context.http + '/gurk')).text()

  t.is(x, `{"error":"[gurk] Function not found.","code":40401}`)

  await wait(10e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})

test.serial.only('get (over http)', async (t: T) => {
  const store: {
    [key: string]: BasedFunctionConfigComplete
  } = {
    hello: {
      type: 'query',
      path: '/counter',
      name: 'hello',
      maxPayloadSize: 1e6,
      rateLimitTokens: 1,
      closeAfterIdleTime: 3e3,
      uninstallAfterIdleTime: 1e3,
      version: 1,
      fn: async (_, __, update) => {
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
      type: 'query',
      path: '/obj',
      name: 'obj',
      maxPayloadSize: 1e6,
      rateLimitTokens: 1,
      version: 1,
      fn: async (_, __, update) => {
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
    port: t.context.port,
    silent: true,
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
  console.log('------->')
  const resultObj = await (await fetch(t.context.http + '/obj')).json()

  console.log(resultObj)
  t.is(typeof resultObj, 'object')

  const result = await (await fetch(t.context.http + '/counter')).text()

  t.is(result, '0')

  await wait(1e3)

  const result2 = await (await fetch(t.context.http + '/counter')).text()

  t.is(result2, '1')

  await wait(1e3)

  const result3 = await (await fetch(t.context.http + '/hello')).text()

  t.is(result3, '2')

  await wait(10e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})

test.serial('functions (over http + contentEncoding)', async (t: T) => {
  const store: {
    [key: string]: BasedFunctionConfigComplete
  } = {
    hello: {
      type: 'function',
      path: '/flap',
      name: 'hello',
      version: 1,
      maxPayloadSize: 1e11,
      rateLimitTokens: 1,
      fn: async (_, payload) => {
        await wait(100)
        if (payload) {
          return payload
        }
        return 'flap'
      },
      httpResponse: async (_based, __, responseData, send, ctx) => {
        if (!ctx.session) {
          return send('')
        }
        if (typeof responseData === 'object') {
          return send(JSON.stringify(responseData), undefined, '200 OkiDoki')
        }
        return send('yesh ' + responseData)
      },
    },
  }

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
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
    await fetch(t.context.http + '/flap', {
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
    await fetch(t.context.http + '/flap', {
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
    await fetch(t.context.http + '/flap', {
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

test.serial('auth', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        flap: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            return 'hello this is fun!!!'
          },
        },
      },
    },
    auth: {
      authorize: async (_, context) => {
        if (context.session?.authState.token === 'bla') {
          return true
        }
        return false
      },
    },
  })
  await server.start()

  const r1 = await (
    await fetch(t.context.http + '/flap', {
      method: 'post',
      headers: {
        // allways token ?
        authorization: encodeAuthState({ token: 'snurp' }),
      },
    })
  ).json()

  t.is(r1.code, 40301)

  const r = await (
    await fetch(t.context.http + '/flap', {
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

test.serial('bad accept-encoding header', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
  })

  server.functions.add({
    hello: {
      type: 'query',
      maxPayloadSize: 1e6,
      name: 'hello',
      fn: async (_, __, update) => {
        let cnt = 0
        update({
          cnt,
          hellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohello:
            'wtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtf',
        })
        const counter = setInterval(() => {
          update({
            cnt: ++cnt,
            hellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohello:
              'wtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtfwtf',
          })
        }, 1000)
        return () => {
          clearInterval(counter)
        }
      },
    },
  })

  await server.start()

  await wait(1e3)

  const r = await (
    await fetch(t.context.http + '/hello', {
      method: 'post',
      headers: {
        'Accept-Encoding': 'derp',
      },
    })
  ).text()

  t.assert(!r.includes('Incorrect content encoding'))

  server.destroy()
})

test.serial('handle application/x-www-form-urlencoded', async (t: T) => {
  const store: {
    [key: string]: BasedFunctionConfigComplete
  } = {
    hello: {
      type: 'function',
      path: '/flap',
      name: 'hello',
      version: 1,
      maxPayloadSize: 1e11,
      rateLimitTokens: 1,
      fn: async (_, payload) => {
        await wait(100)
        return payload
      },
    },
  }

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      // closeAfterIdleTime: { query: 3e3, channel: 3e3 },
      // uninstallAfterIdleTime: 3e3,
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

  const data = {
    one: 'one',
    two: 'two',
    three: 'four',
  }

  const body = querystring.stringify(data)

  const result1 = await (
    await fetch(t.context.http + '/flap', {
      method: 'post',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    })
  ).json()

  t.deepEqual(result1, data)

  server.destroy()
})
