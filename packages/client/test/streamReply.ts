import test from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src'
import { createReadStream, readFileSync } from 'fs'
import { join } from 'path'
import fetch from 'cross-fetch'

test.serial('reply with a stream from call fn (http)', async (t) => {
  const filePath = join(__dirname, './browser/tmp.json')
  const server = new BasedServer({
    port: 9910,
    functions: {
      specs: {
        mySnur: {
          uninstallAfterIdleTime: 1e3,
          function: async () => {
            return createReadStream(filePath)
          },
        },
        mimeSnur: {
          uninstallAfterIdleTime: 1e3,
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
    },
  })
  await server.start()
  const client = new BasedClient()
  client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const r1 = await fetch('http://localhost:9910/mySnur')
  const result = await r1.text()
  t.deepEqual(result, readFileSync(filePath).toString())

  const r = await fetch('http://localhost:9910/mimeSnur')
  t.is(r.headers.get('content-type'), 'application/json')
  t.is(r.headers.get('flapje'), '123')
  const result2 = await r.text()
  t.deepEqual(result2, readFileSync(filePath).toString())
  client.disconnect()
  await server.destroy()
})

// extra protocol in WS
// test.serial('reply with a stream from call fn (http)', async (t) => {
//   const filePath = join(__dirname, './browser/tmp.json')
//   const server = await createSimpleServer({ uninstallAfterIdleTime: 1e3,
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
