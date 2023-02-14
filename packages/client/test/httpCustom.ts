import test from 'ava'
import { createSimpleServer } from '@based/server'
import fetch from 'cross-fetch'

test.serial('custom http response', async (t) => {
  const server = await createSimpleServer({
    idleTimeout: 1e3,
    port: 9910,
    queryFunctions: {
      bla: {
        httpResponse: async (based, payload, responseData, send) => {
          send(responseData, {
            blabla: [1, 2, 3, 4],
          })
        },
        function: (based, payload, update) => {
          update('?')
          return () => {}
        },
      },
    },
    functions: {
      hello: {
        function: async () => {
          return 'flap'
        },
        httpResponse: async (based, payload, responseData, send) => {
          send(responseData, {
            blabla: [1, 2, 3, 4],
          })
        },
      },
    },
  })

  const rawResp = await fetch('http://localhost:9910/hello')
  t.is(rawResp.headers.get('blabla'), '1,2,3,4')
  const result = await rawResp.text()
  t.is(result, 'flap')
  const rawRespGet = await fetch('http://localhost:9910/bla')
  t.is(rawRespGet.headers.get('blabla'), '1,2,3,4')
  const resultGet = await rawRespGet.text()
  // get is by default json parsed
  t.is(resultGet, '"?"')
  await server.destroy()
})
