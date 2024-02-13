import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
// import { readStream } from '@saulx/utils'
import { Readable } from 'node:stream'
import getPort from 'get-port'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'

import { Stream, Writable } from 'stream'

export const readStream = (
  stream: Stream,
  opts?: { throttle?: number; maxCunkSize?: number }
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const maxCunkSize = opts?.maxCunkSize ?? 0
    const throttle = opts?.throttle ?? 0
    const buffers: Buffer[] = []

    const processChunk = (c, next) => {
      const x = c.slice(0, maxCunkSize)
      buffers.push(x)
      const chunkP = c.slice(maxCunkSize)
      console.log(
        c.byteLength,
        chunkP.byteLength + maxCunkSize,
        x.byteLength === maxCunkSize
      )

      if (chunkP.byteLength > maxCunkSize) {
        if (throttle) {
          setTimeout(() => {
            processChunk(chunkP, next)
          }, throttle)
        } else {
          processChunk(chunkP, next)
        }
      } else {
        if (throttle) {
          setTimeout(() => {
            next()
          }, throttle)
        } else {
          next()
        }
      }
    }

    const s = new Writable({
      write: (c, _encoding, next) => {
        if (maxCunkSize && c.byteLength > maxCunkSize) {
          processChunk(c, next)
        } else {
          if (typeof c === 'string') {
            buffers.push(Buffer.from(c))
          } else {
            buffers.push(c)
          }
          if (throttle) {
            setTimeout(() => {
              next()
            }, throttle)
          } else {
            next()
          }
        }
      },
    })

    s.on('error', (err) => {
      reject(err)
    })

    s.on('finish', () => {
      console.info('DONE! !!!!', resolve)
      resolve(Buffer.concat(buffers))
    })

    stream.pipe(s)
  })

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('stream small chunks', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: {
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1,
          maxPayloadSize: 1e9,
          fn: async (_, { stream, payload }) => {
            stream.on('progress', (d) => {
              console.info(stream)
            })

            stream.on('data', (c) => {
              console.log(c.byteLength)
            })

            stream.on('end', () => {
              console.log('yo rdy')
            })

            stream.on('finish', () => {
              console.log('yo rdy FINISH')
            })

            const x = await readStream(stream, {
              throttle: 10,
              maxCunkSize: 1000,
            })
            const y = new TextDecoder().decode(x)
            const len = JSON.parse(y).length
            return len
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

  const len = 10000
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
