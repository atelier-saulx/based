import test from 'ava'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'

test.serial('custom http response', async (t) => {
  const server = new BasedServer({
    port: 9910,
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
  const rawResp = await fetch('http://localhost:9910/hello')
  t.is(rawResp.headers.get('blabla'), '1,2,3,4')
  const result = await rawResp.text()
  t.is(result, 'flap')
  const rawRespGet = await fetch('http://localhost:9910/bla')
  t.is(rawRespGet.headers.get('blabla'), '1,2,3,4')
  const resultGet = await rawRespGet.text()
  // Get is by default json parsed
  t.is(resultGet, '"?"')
  await server.destroy()
})
