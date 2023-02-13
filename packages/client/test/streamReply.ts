import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { createReadStream, readFileSync } from 'fs'
import { join } from 'path'
import fetch from 'cross-fetch'

test.serial('reply with a stream from call fn (http)', async (t) => {
  const filePath = join(__dirname, './browser/tmp.json')
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      mySnur: async () => {
        return createReadStream(filePath)
      },
      mimeSnur: {
        httpResponse: async (based, payload, responseData, send) => {
          send(responseData, {
            'content-type': 'application/json',
            flapje: '123',
          })
        },
        function: async () => {
          return createReadStream(filePath)
        },
      },
    },
  })
  const client = new BasedClient()
  client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const r = await fetch('http://localhost:9910/mySnur')
  t.is(r.headers.get('content-type'), 'application/json')
  t.is(r.headers.get('flapje'), '123')
  const result = await r.text()
  t.deepEqual(result, readFileSync(filePath).toString())
  client.disconnect()
  await server.destroy()
})

// extra protocol....
// test.serial('reply with a stream from call fn (http)', async (t) => {
//   const filePath = join(__dirname, './browser/tmp.json')
//   const server = await createSimpleServer({
//     port: 9910,
//     functions: {
//       mySnur: async () => {
//         return createReadStream(filePath)
//       },
//     },
//   })
//   const client = new BasedClient()
//   client.connect({
//     url: async () => 'ws://localhost:9910',
//   })
//   const result = await (await fetch('http://localhost:9910/mySnur')).text()
//   t.deepEqual(result, readFileSync(filePath).toString())
//   client.disconnect()
//   await server.destroy()
// })
