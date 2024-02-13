import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { readStream } from '@saulx/utils'
import { Readable } from 'node:stream'
import getPort from 'get-port'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

/*
  async streamNew(
    name: string,
    opts: StreamFunctionOpts,
    progressListener?: (progress: number) => void
  ): Promise<any> {
    // @ts-ignore
    if (isStreamFunctionOpts(opts)) {
      let reqId = ++this.streamRequestId
      if (reqId > 16777215) {
        reqId = 0
      }
      let seqId = 0

      addStreamRegister(
        this,
        reqId,
        opts.size,
        opts.fileName,
        opts.mimeType,
        name,
        opts.payload
      )

      opts.contents.on('data', (chunk) => {
        addStreamChunk(this, reqId, ++seqId, chunk)
      })

      return new Promise((resolve, reject) => {
        this.streamFunctionResponseListeners.set(reqId, [resolve, reject])
      })
    }
  }
*/

test('stream small chunks', async (t: T) => {
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
            stream.on('data', (c) => {
              console.log('CHUNK', c.length)
            })

            const x = await readStream(stream, {
              throttle: 100,
              maxCunkSize: 10000,
            })
            console.log(x)

            const y = new TextDecoder().decode(x)
            // const len = JSON.parse(y).length
            return y
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

  const len = 1000000

  const bigBod: any[] = []

  for (let i = 0; i < len; i++) {
    bigBod.push({ flap: 'snurp', i })
  }

  const payload = new Uint8Array(Buffer.from(JSON.stringify(bigBod)))

  async function* generate() {
    const readBytes = 10000
    let index = 0
    while (index * readBytes < payload.byteLength) {
      const buf = payload.slice(
        index * readBytes,
        Math.min(payload.byteLength, (index + 1) * readBytes)
      )
      index++
      yield buf
    }
  }

  const result = await client.stream(
    'hello',
    {
      payload: { power: true },
      size: payload.byteLength,
      mimeType: 'application/json',
      contents: Readable.from(generate()),
    },
    (p) => {
      console.log('PROGRESS', Math.round(p * 100), '%')
    }
  )

  console.info('DERP', result)

  t.is(result, len)

  // cycles of 3 secs
  client.disconnect()
  await server.destroy()

  t.pass()
})
