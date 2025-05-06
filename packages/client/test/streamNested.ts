import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { readStream, wait } from '@saulx/utils'
import { stat, createReadStream, readFileSync } from 'fs'
import { promisify } from 'util'

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

const statAsync = promisify(stat)

test('stream nested functions (string)', async (t: T) => {
  const progressEvents: number[] = []
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        mySnur: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload) => {
            return based.stream('hello', {
              contents: 'power stream',
              payload,
            })
          },
        },
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1,
          maxPayloadSize: 1e9,
          fn: async (_, { stream, payload }) => {
            stream.on('progress', (d) => {
              progressEvents.push(d)
            })
            const result = await readStream(stream)
            return { payload, result: result.toString() }
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
  for (let i = 0; i < 10; i++) {
    bigBod.push({ flap: 'snurp', i })
  }
  const { payload, result } = await client.call('mySnur', { power: true })

  await wait(2e3)

  t.deepEqual(payload, { power: true })
  t.deepEqual(result, 'power stream')

  t.true(progressEvents.length > 0)
  t.is(progressEvents[progressEvents.length - 1], 1)
  // cycles of 3 secs
  client.disconnect()
  await server.destroy()
})

test.serial('stream nested functions (stream)', async (t: T) => {
  const progressEvents: number[] = []
  const filePath = join(__dirname, './browser/tmp.json')
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        mySnur: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload) => {
            return based.stream('hello', {
              contents: createReadStream(filePath),
              size: (await statAsync(filePath)).size,
              payload,
            })
          },
        },
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1,
          maxPayloadSize: 1e9,
          fn: async (_, { stream, payload }) => {
            stream.on('progress', (d) => {
              progressEvents.push(d)
            })
            const result = await readStream(stream)
            return { payload, result: result.toString() }
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
  for (let i = 0; i < 10; i++) {
    bigBod.push({ flap: 'snurp', i })
  }
  const { payload, result } = await client.call('mySnur', { power: true })

  await wait(2e3)

  t.deepEqual(payload, { power: true })
  t.deepEqual(result, readFileSync(filePath).toString())

  t.true(progressEvents.length > 0)
  t.is(progressEvents[progressEvents.length - 1], 1)
  // cycles of 3 secs
  client.disconnect()
  await server.destroy()
})
