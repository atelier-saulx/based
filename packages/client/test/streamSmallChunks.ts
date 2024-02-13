import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { Readable } from 'node:stream'
import getPort from 'get-port'
import { readStream } from '@saulx/utils'

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

  const len = 1000
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

  try {
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
    t.is(result, len)
  } catch (err) {
    console.error(err)
    t.fail('Should not error in fn')
  }
  client.disconnect()
  await server.destroy()

  t.pass()
})
