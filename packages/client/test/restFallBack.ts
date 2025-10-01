import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'
import getPort from 'get-port'
import { parseAuthState } from '@based/server/dist/auth/index.js'
import { encodeAuthState } from '@based/client-old'
import { encodeFunctionMessage } from '../src/outgoing/protocol.js'
import { concatUint8Arr } from '@based/utils'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('rest fallback', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        bla: {
          type: 'query',
          public: true,
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            update('?')
            return () => {}
          },
        },
        hello: {
          type: 'function',
          public: true,
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            console.log('flap')
            return 'flap'
          },
        },
      },
    },
  })
  await server.start()

  // based:rpstatus'
  const rawResp = await (await fetch(t.context.http + '/based:rpstatus')).text()

  const authState = encodeAuthState({})
  const path = t.context.http + '/' + rawResp + '/' + authState

  console.info({ path })

  // body: binary,
  //     headers: {
  //       'content-length': String(binary.byteLength),
  //     },

  const fn = concatUint8Arr(encodeFunctionMessage([1, 'hello', {}]).buffers)

  console.log('flap--->', fn)

  const derp = await (
    await fetch(path, {
      method: 'post',
      // @ts-ignore
      body: fn,
      headers: {
        'content-length': String(fn.byteLength),
      },
    })
  ).text()

  console.info({ derp })

  t.true(true)

  await server.destroy()
})
