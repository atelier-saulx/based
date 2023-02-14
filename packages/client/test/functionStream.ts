import test from 'ava'
// import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import fetch from 'cross-fetch'
import { createReadStream, readFileSync } from 'fs'
import { join } from 'path'

test.serial('function Stream (http)', async (t) => {
  const p = join(__dirname, '../package.json')

  const server = await createSimpleServer({
    idleTimeout: 1e3,
    port: 9910,
    functions: {
      hello: {
        maxPayloadSize: 1e8,
        function: async () => {
          return createReadStream(p)
        },
      },
    },
  })

  server.on('error', console.error)

  const x = await fetch('http://localhost:9910/hello')
  const y = await x.text()

  const file = readFileSync(p)
  t.is(y, file.toString())

  await server.destroy()
})
