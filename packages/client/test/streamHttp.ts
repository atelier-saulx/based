import test from 'ava'
import { BasedServer } from '@based/server'
import { wait, readStream } from '@saulx/utils'
import fetch from 'cross-fetch'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const gzip = promisify(zlib.gzip)

test.serial('stream functions (small over http + file)', async (t) => {
  const progressEvents: number[] = []

  const server = new BasedServer({
    port: 9910,
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
    await fetch('http://localhost:9910/hello?bla', {
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

test.serial('stream functions (over http + stream)', async (t) => {
  let progressEvents: number[] = []

  const server = new BasedServer({
    port: 9910,
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
            console.info('is end...', buf.byteLength)
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
    await fetch('http://localhost:9910/hello', {
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
      await fetch('http://localhost:9910/hello', {
        method: 'post',
        headers: {
          'content-encoding': 'gzip',
          'content-type': 'application/json',
        },
        body: x,
      })
    ).text()

    t.is(resultBrotli, 'bla')
  } catch (err) {
    console.info('ERROR', err)
    t.fail('Crash with uncompressing')
  }

  t.true(progressEvents.length > 0)
  t.is(progressEvents[progressEvents.length - 1], 1)

  await wait(6e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})
