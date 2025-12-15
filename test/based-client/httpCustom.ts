import test, { ExecutionContext } from 'ava'
import getPort from 'get-port'
import { BasedServer } from '../../src/server/index.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('custom http response', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        bla: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          httpResponse: async (_, __, responseData, send) => {
            send(responseData, {
              blabla: [1, 2, 3, 4],
            })
          },
          fn: (_, __, update) => {
            update('?')
            return () => {}
          },
        },
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            return 'flap'
          },
          httpResponse: async (_, __, responseData, send) => {
            send(responseData, {
              blabla: [1, 2, 3, 4],
            })
          },
        },
      },
    },
  })
  await server.start()
  const rawResp = await fetch(t.context.http + '/hello')
  t.is(rawResp.headers.get('blabla'), '1,2,3,4')
  const result = await rawResp.text()
  t.is(result, 'flap')
  const rawRespGet = await fetch(t.context.http + '/bla')
  t.is(rawRespGet.headers.get('blabla'), '1,2,3,4')
  const resultGet = await rawRespGet.text()
  t.is(resultGet, '?')
  await server.destroy()
})
