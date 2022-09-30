import test from 'ava'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import http from 'node:http'

const deflate = promisify(zlib.deflate)
const gzip = promisify(zlib.gzip)
const br = promisify(zlib.brotliCompress)

test.serial('functions (over http)', async (t) => {
  const store = {
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

      log: (opts) => {
        console.info('-->', opts)
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

  t.is(x, `{"error":"Not found","code":404}`)

  await wait(10e3)

  t.is(Object.keys(server.functions.functions).length, 0)

  server.destroy()
})

test.serial('get (over http)', async (t) => {
  const store = {
    hello: {
      path: '/counter',
      name: 'hello',
      checksum: 1,
      observable: true,
      function: async (payload, update) => {
        let cnt = 0
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
      log: (opts) => {
        console.info('-->', opts)
      },
    },
  })

  const result = await (await fetch('http://localhost:9910/counter')).text()

  t.is(result, '1')

  await wait(1e3)

  const result2 = await (await fetch('http://localhost:9910/counter')).text()

  t.is(result2, '2')

  const result3 = await (await fetch('http://localhost:9910/hello')).text()

  t.is(result3, '2')

  await wait(10e3)

  t.is(Object.keys(server.functions.observables).length, 0)

  server.destroy()
})

test.serial.only('functions (over http + contentEncoding)', async (t) => {
  const store = {
    hello: {
      path: '/flap',
      name: 'hello',
      checksum: 1,
      function: async (payload) => {
        await wait(100)
        console.log('goootttt some payloadsss', payload)
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

      log: (opts) => {
        console.info('-->', opts)
      },
    },
  })

  // const result1 = await (
  //   await fetch('http://localhost:9910/flap', {
  //     method: 'post',
  //     headers: {
  //       'content-encoding': 'deflate',
  //       'content-type': 'application/json',
  //     },
  //     body: await deflate(JSON.stringify({ flurp: 1 })),
  //   })
  // ).text()

  // t.is(result1, '{"flurp":1}')

  // const result2 = await (
  //   await fetch('http://localhost:9910/flap', {
  //     method: 'post',
  //     headers: {
  //       'content-encoding': 'gzip',
  //       'content-type': 'application/json',
  //     },
  //     body: await gzip(JSON.stringify({ flurp: 2 })),
  //   })
  // ).text()

  // t.is(result2, '{"flurp":2}')

  const large: any[] = []
  for (let i = 0; i < 100000; i++) {
    large.push({ i, gur: 'gur' })
  }

  const gzipBod = await gzip(JSON.stringify(large))

  console.info('send', gzipBod.byteLength)

  const options = {
    port: 9910,
    host: 'localhost',
    method: 'POST',
    path: '/flap',
    chunkSize: 50 * 1024,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': gzipBod.length,
      'Content-Encoding': 'gzip',
    },
  }

  const req = http.request(options)

  const chunkSize = 10 * 1024
  const end = Math.ceil(gzipBod.byteLength / chunkSize)

  const write = (c: Buffer): Promise<void> => {
    return new Promise((resolve) => {
      req.write(c, () => {
        resolve()
      })
    })
  }

  for (let i = 0; i < end; i++) {
    const c = gzipBod.slice(
      i * chunkSize,
      Math.min((i + 1) * chunkSize, gzipBod.byteLength)
    )
    // console.log('writing', i * chunkSize)
    // if (i === end - 1) {
    //   req.end(c)
    // } else {
    await write(c)
    await wait(10)

    // }
  }

  req.on('response', () => {
    console.log('resp')
  })

  req.on('error', (err) => {
    console.log('??', err)
  })

  // req.on('end', function () {
  //   req.end()
  // })

  // const result3 = await (
  //   await fetch('http://localhost:9910/flap', {
  //     method: 'post',

  //     headers: {
  //       'content-encoding': 'gzip',
  //       'content-type': 'application/json',
  //     },
  //     body: gzipBod,
  //   })
  // ).json()

  // console.log(result3)

  // t.deepEqual(result3, large)

  await wait(10e3)

  t.is(Object.keys(server.functions.functions).length, 0)

  server.destroy()
})
