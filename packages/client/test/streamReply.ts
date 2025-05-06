import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { createReadStream, readFileSync } from 'fs'
import fetch from 'cross-fetch'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

test('reply with a stream from call fn (http)', async (t: T) => {
  const filePath = join(__dirname, './browser/tmp.json')
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        mySnur: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            return createReadStream(filePath)
          },
        },
        mimeSnur: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          httpResponse: async (_, __, responseData, send) => {
            send(responseData, {
              'content-type': 'application/json',
              flapje: '123',
            })
          },
          fn: async () => {
            return createReadStream(filePath)
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  client.connect({
    url: async () => t.context.ws,
  })
  const r1 = await fetch(t.context.http + '/mySnur')
  const result = await r1.text()
  t.deepEqual(result, readFileSync(filePath).toString())

  const r = await fetch(t.context.http + '/mimeSnur')
  t.is(r.headers.get('content-type'), 'application/json')
  t.is(r.headers.get('flapje'), '123')
  const result2 = await r.text()
  t.deepEqual(result2, readFileSync(filePath).toString())
  client.disconnect()
  await server.destroy()
})
