import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'
import { createReadStream, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

test('function Stream (http)', async (t: T) => {
  const p = join(__dirname, '../package.json')

  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: {
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          maxPayloadSize: 1e8,
          fn: async () => {
            return createReadStream(p)
          },
        },
      },
    },
  })

  await server.start()

  server.on('error', console.error)

  const x = await fetch(t.context.http + '/hello')
  const y = await x.text()

  const file = readFileSync(p)
  t.is(y, file.toString())

  await server.destroy()
})
