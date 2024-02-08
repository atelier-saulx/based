import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { wait, readStream } from '@saulx/utils'
// import { Duplex } from 'node:stream'
// import { readFileSync } from 'node:fs'
// import { dirname, join } from 'node:path'
// import { fileURLToPath } from 'url'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

// const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

test('stream new', async (t: T) => {
  const progressEvents: number[] = []

  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: {
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1,
          maxPayloadSize: 1e9,
          fn: async (_, { stream, payload }) => {
            console.log('blargf1', payload)
            stream.on('progress', (d) => {
              progressEvents.push(d)
            })
            await readStream(stream)
            return payload
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

  // prob want to send contents in register if its small enough

  const s = await client.streamNew('hello', {
    payload: { power: true },
    contents: 'flap',
  })

  console.log(s)

  // cycles of 3 secs
  await wait(6e3)
  client.disconnect()
  await server.destroy()

  t.pass()
})
