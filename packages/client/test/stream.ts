import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { wait, readStream } from '@saulx/utils'
import fetch from 'cross-fetch'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const gzip = promisify(zlib.gzip)

test.serial('stream functions (small over http + stream)', async (t) => {
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: {
        stream: true,
        function: async () => {
          return 'bla'
        },
      },
    },
  })

  const result = await (
    await fetch('http://localhost:9910/hello', {
      method: 'post',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'my snurky' }),
    })
  ).text()

  t.is(result, 'bla')

  await wait(6e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})

test.serial('stream functions (over http + stream)', async (t) => {
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: {
        maxPayloadSize: 1e9,
        stream: true,
        function: async ({ stream }) => {
          const buf = await readStream(stream)
          console.info('is end...', buf.byteLength)
          return 'bla'
        },
      },
    },
  })

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

  await wait(15e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})

test.serial.only('stream functions using client helper', async (t) => {
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: {
        maxPayloadSize: 1e9,
        stream: true,
        function: async ({ stream }) => {
          const buf = await readStream(stream)
          console.info('is end...', buf.byteLength)
          return 'bla'
        },
      },
    },
  })

  const client = new BasedClient()

  client.connect({
    url: async () => 'ws://localhost:9910',
  })

  client.stream('hello')

  await wait(15e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})
