import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { wait, readStream } from '@saulx/utils'
import { Duplex } from 'node:stream'
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
            console.log('blargf1', payload, stream, stream.size)
            stream.on('progress', (d) => {
              console.info(stream)
              progressEvents.push(d)
            })
            const x = await readStream(stream)
            const y = new TextDecoder().decode(x)
            console.log('received', JSON.parse(y).length, 'things')
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

  const bigBod: any[] = []
  for (let i = 0; i < 1000000; i++) {
    bigBod.push({ flap: 'snurp', i })
  }

  const payload = new Uint8Array(Buffer.from(JSON.stringify(bigBod)))

  const stream = new Duplex({
    read() {},
    write(x) {
      this.push(x)
    },
  })

  let index = 0
  const streamBits = () => {
    const readBytes = 100000
    const end = (index + 1) * readBytes
    if (end > payload.byteLength) {
      stream.push(payload.slice(index * readBytes, end))
      stream.push(null)
    } else {
      stream.push(payload.slice(index * readBytes, end))
      setTimeout(() => {
        index++
        streamBits()
      }, 5)
    }
  }

  streamBits()

  // deflate as option ? e.g. for videos bit unnsecary
  const s = await client.streamNew('hello', {
    payload: { power: true },
    size: payload.byteLength,
    mimeType: 'pipo',
    contents: stream,
  })

  console.log('GO RESULT!', s)

  // cycles of 3 secs
  client.disconnect()
  await server.destroy()

  t.pass()
})
