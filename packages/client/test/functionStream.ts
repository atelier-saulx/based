import test from 'ava'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'
import { createReadStream, readFileSync } from 'fs'
import { join } from 'path'

test.serial('function Stream (http)', async (t) => {
  const p = join(__dirname, '../package.json')

  const server = new BasedServer({
    port: 9910,
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

  const x = await fetch('http://localhost:9910/hello')
  const y = await x.text()

  const file = readFileSync(p)
  t.is(y, file.toString())

  await server.destroy()
})
