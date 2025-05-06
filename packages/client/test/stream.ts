import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { wait, readStream } from '@saulx/utils'
import { Duplex } from 'node:stream'
import { readFileSync, createReadStream } from 'node:fs'
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

test('stream functions - buffer contents', async (t: T) => {
  const progressEvents: number[] = []

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1,
          maxPayloadSize: 1e9,
          fn: async (_, { stream, payload }) => {
            stream.on('progress', (d) => {
              progressEvents.push(d)
            })
            stream.on('data', (c) => {})
            const r = await readStream(stream)
            const decoder = new TextDecoder()
            const str = decoder.decode(r)
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
  for (let i = 0; i < 10; i++) {
    bigBod.push({ flap: 'snurp', i })
  }
  const s = await client.stream('hello', {
    payload: { power: true },
    contents: Buffer.from(JSON.stringify(bigBod)),
  })
  t.deepEqual(s, { power: true })
  t.true(progressEvents.length > 0)
  t.is(progressEvents[progressEvents.length - 1], 1)
  await wait(6e3)
  t.is(Object.keys(server.functions.specs).length, 0)
  client.disconnect()
  await server.destroy()
})

test('stream functions - streamContents', async (t: T) => {
  const progressEvents: number[] = []

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1,
          maxPayloadSize: 1e9,
          fn: async (_, { stream, payload, mimeType, size }) => {
            let cnt = 0
            stream.on('progress', (d) => {
              progressEvents.push(d)
            })
            stream.on('data', () => {
              cnt++
            })
            await readStream(stream)
            return { payload, cnt, mimeType, size }
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
  for (let i = 0; i < 100000; i++) {
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
      }, 100)
    }
  }
  streamBits()
  const s = await client.stream('hello', {
    payload: { power: true },
    size: payload.byteLength,
    mimeType: 'pipo',
    contents: stream,
  })

  t.true(progressEvents.length > 0)
  t.is(progressEvents[progressEvents.length - 1], 1)
  t.true(s.cnt > 5)
  t.is(s.mimeType, 'pipo')
  t.is(s.size, payload.byteLength)
  t.deepEqual(s.payload, { power: true })
  client.disconnect()
  await server.destroy()
})

test('stream functions - streamContents error', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1,
          maxPayloadSize: 1e9,
          fn: async () => {
            throw new Error('bla')
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
    }),
  )
  client.disconnect()
  await server.destroy()
})

test('stream functions - path', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1,
          maxPayloadSize: 1e9,
          fn: async (_, x) => {
            const { payload, stream, mimeType } = x
            const file = (await readStream(stream)).toString()
            return { payload, file, mimeType }
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

test('stream functions - path json', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1e6,
          maxPayloadSize: 1e100,
          fn: async (_, x) => {
            const { payload, stream, mimeType } = x
            stream.on('end', () => {})
            const file = await readStream(stream)
            return { payload, mimeType, file: file.toString() }
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

test('stream functions - filename', async (t: T) => {
  const name = 'sldfoifgn09oijdf08wlejknf'

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1e6,
          maxPayloadSize: 1e100,
          fn: async (_based, streamPayload) => {
            const { fileName } = streamPayload
            return { fileName }
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

  const s = await client.stream('hello', {
    fileName: name,
    path: join(__dirname, '/browser/tmp.json'),
  })
  t.deepEqual(s, {
    fileName: name,
  })
  client.disconnect()
  await server.destroy()
})
