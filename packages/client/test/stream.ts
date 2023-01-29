import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { wait, readStream } from '@saulx/utils'
import { Duplex } from 'node:stream'
import { join } from 'path'
import { readFileSync } from 'node:fs'

test.serial('stream functions - buffer contents', async (t) => {
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: {
        idleTimeout: 1,
        maxPayloadSize: 1e9,
        stream: true,
        function: async (based, { stream, payload }) => {
          await readStream(stream)
          return payload
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
  const s = await client.stream('hello', {
    payload: { power: true },
    contents: Buffer.from(JSON.stringify(bigBod), 'base64'),
  })
  t.deepEqual(s, { power: true })
  // cycles of 3 secs
  await wait(6e3)
  t.is(Object.keys(server.functions.specs).length, 0)
  client.disconnect()
  await server.destroy()
})

test.serial('stream functions - streamContents', async (t) => {
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: {
        idleTimeout: 1,
        maxPayloadSize: 1e9,
        stream: true,
        function: async (based, { stream, payload, mimeType, size }) => {
          let cnt = 0
          stream.on('data', () => {
            cnt++
          })
          await readStream(stream)
          return { payload, cnt, mimeType, size }
        },
      },
    },
  })
  const client = new BasedClient()
  client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const bigBod: any[] = []
  for (let i = 0; i < 1000; i++) {
    bigBod.push({ flap: 'snurp', i })
  }
  const payload = Buffer.from(JSON.stringify(bigBod))
  const stream = new Duplex({
    read() {},
    write(x) {
      this.push(x)
    },
  })
  let index = 0
  const streamBits = () => {
    const readBytes = 1000
    const end = (index + 1) * readBytes
    if (end > payload.byteLength) {
      stream.push(payload.slice(index * readBytes, end))
      stream.push(null)
    } else {
      stream.push(payload.slice(index * readBytes, end))
      setTimeout(() => {
        index++
        streamBits()
      }, 18)
    }
  }
  streamBits()
  const s = await client.stream('hello', {
    payload: { power: true },
    size: payload.byteLength,
    mimeType: 'pipo',
    contents: stream,
  })
  t.true(s.cnt > 5)
  t.is(s.mimeType, 'pipo')
  t.is(s.size, payload.byteLength)
  t.deepEqual(s.payload, { power: true })
  client.disconnect()
  await server.destroy()
})

test.serial('stream functions - streamContents error', async (t) => {
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: {
        idleTimeout: 1,
        maxPayloadSize: 1e9,
        stream: true,
        function: async () => {
          throw new Error('bla')
        },
      },
    },
  })
  const client = new BasedClient()
  client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const bigBod: any[] = []
  for (let i = 0; i < 1000; i++) {
    bigBod.push({ flap: 'snurp', i })
  }
  const payload = Buffer.from(JSON.stringify(bigBod))
  const stream = new Duplex({
    read() {},
    write(x) {
      this.push(x)
    },
  })
  let index = 0
  const streamBits = () => {
    const readBytes = 1000
    const end = (index + 1) * readBytes
    if (end > payload.byteLength) {
      stream.push(payload.slice(index * readBytes, end))
      stream.push(null)
    } else {
      stream.push(payload.slice(index * readBytes, end))
      setTimeout(() => {
        index++
        streamBits()
      }, 18)
    }
  }
  streamBits()
  await t.throwsAsync(
    client.stream('hello', {
      payload: { power: true },
      size: payload.byteLength,
      contents: stream,
    })
  )
  client.disconnect()
  await server.destroy()
})

test.serial('stream functions - path', async (t) => {
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: {
        idleTimeout: 1,
        maxPayloadSize: 1e9,
        stream: true,
        function: async (based, x) => {
          const { payload, stream, mimeType } = x
          const file = (await readStream(stream)).toString()
          return { payload, file, mimeType }
        },
      },
    },
  })
  const client = new BasedClient()
  client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const s = await client.stream('hello', {
    payload: { power: true },
    mimeType: 'text/typescript',
    path: join(__dirname, '/functions.ts'),
  })
  t.deepEqual(s, {
    mimeType: 'text/typescript',
    payload: { power: true },
    file: readFileSync(join(__dirname, '/functions.ts')).toString(),
  })
  client.disconnect()
  await server.destroy()
})

test.serial('stream functions - path json', async (t) => {
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: {
        idleTimeout: 1,
        maxPayloadSize: 1e9,
        stream: true,
        function: async (based, x) => {
          const { payload, stream, mimeType } = x
          const file = (await readStream(stream)).toString()
          return { payload, file, mimeType }
        },
      },
    },
  })
  const client = new BasedClient()
  client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const s = await client.stream('hello', {
    payload: { power: true },
    path: join(__dirname, '/browser/tmp.json'),
  })
  t.deepEqual(s, {
    mimeType: 'application/json',
    payload: { power: true },
    file: readFileSync(join(__dirname, '/browser/tmp.json')).toString(),
  })
  client.disconnect()
  await server.destroy()
})
