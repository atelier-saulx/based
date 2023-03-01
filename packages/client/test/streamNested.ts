import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { readStream, wait } from '@saulx/utils'
import { stat, createReadStream, readFileSync } from 'fs'
import { promisify } from 'util'
import { join } from 'path'

const statAsync = promisify(stat)

test.serial('stream nested functions (string)', async (t) => {
  const progressEvents: number[] = []
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    functions: {
      mySnur: async (based, payload) => {
        return based.stream('hello', {
          contents: 'power stream',
          payload,
        })
      },
    },
    streams: {
      hello: {
        uninstallAfterIdleTime: 1,
        maxPayloadSize: 1e9,
        stream: true,
        function: async (based, { stream, payload }) => {
          stream.on('progress', (d) => {
            progressEvents.push(d)
          })
          const result = await readStream(stream)
          return { payload, result: result.toString() }
        },
      },
    },
  })
  const client = new BasedClient()
  client.connect({
    url: async () => 'ws://localhost:9910',
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

test.serial('stream nested functions (stream)', async (t) => {
  const progressEvents: number[] = []
  const filePath = join(__dirname, './browser/tmp.json')
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    functions: {
      mySnur: async (based, payload) => {
        return based.stream('hello', {
          contents: createReadStream(filePath),
          size: (await statAsync(filePath)).size,
          payload,
        })
      },
    },
    streams: {
      hello: {
        uninstallAfterIdleTime: 1,
        maxPayloadSize: 1e9,
        stream: true,
        function: async (based, { stream, payload }) => {
          stream.on('progress', (d) => {
            progressEvents.push(d)
          })
          const result = await readStream(stream)
          return { payload, result: result.toString() }
        },
      },
    },
  })
  const client = new BasedClient()
  client.connect({
    url: async () => 'ws://localhost:9910',
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
