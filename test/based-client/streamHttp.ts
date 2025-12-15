import test, { ExecutionContext } from 'ava'
import { wait, readStream } from '@based/utils'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import getPort from 'get-port'
import { BasedServer } from '../../src/server/index.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

const gzip = promisify(zlib.gzip)

test('stream functions (small over http + file)', async (t: T) => {
  const progressEvents: number[] = []

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1e3,
          fn: async (_, { stream, payload }) => {
            stream.on('progress', (d) => {
              progressEvents.push(d)
            })
            await readStream(stream)
            return { payload, bla: true }
          },
        },
      },
    },
  })

  await server.start()

  const result = await (
    await fetch(t.context.http + '/hello?bla', {
      method: 'post',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'my snurky' }),
    })
  ).json()
  t.deepEqual(result, { bla: true, payload: { bla: true } })

  t.true(progressEvents.length > 0)
  t.is(progressEvents[progressEvents.length - 1], 1)

  await wait(6e3)
  t.is(Object.keys(server.functions.specs).length, 0)
  server.destroy()
})

test('stream functions (over http + stream)', async (t: T) => {
  let progressEvents: number[] = []

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          maxPayloadSize: 1e9,
          uninstallAfterIdleTime: 1e3,
          type: 'stream',
          fn: async (_, { stream }) => {
            stream.on('progress', (d) => {
              progressEvents.push(d)
            })
            const buf = await readStream(stream)
            return 'bla'
          },
        },
      },
    },
  })
  await server.start()

  const bigBod: any[] = []

  for (let i = 0; i < 1e5; i++) {
    bigBod.push({ flap: 'snurp', i })
  }

  const result = await (
    await fetch(t.context.http + '/hello', {
      method: 'post',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(bigBod),
    })
  ).text()

  t.is(result, 'bla')

  t.true(progressEvents.length > 0)
  t.is(progressEvents[progressEvents.length - 1], 1)

  progressEvents = []

  const x = await gzip(JSON.stringify(bigBod))

  try {
    const resultBrotli = await (
      await fetch(t.context.http + '/hello', {
        method: 'post',
        headers: {
          'content-encoding': 'gzip',
          'content-type': 'application/json',
        },
        // @ts-ignore
        body: x,
      })
    ).text()

    t.is(resultBrotli, 'bla')
  } catch (err) {
    t.fail('Crash with uncompressing')
  }

  t.true(progressEvents.length > 0)
  t.is(progressEvents[progressEvents.length - 1], 1)

  await wait(6e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})
