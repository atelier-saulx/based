import test from 'ava'
import { createSimpleServer } from '@based/server'
import fetch from 'cross-fetch'

test.serial('custom http response', async (t) => {
  const server = await createSimpleServer({
    port: 9910,
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

  console.log(rawResp)
  const result = await rawResp.text()

  t.is(result, 'flap')

  await server.destroy()
})
