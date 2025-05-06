import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import getPort from 'get-port'
import { wait, readStream } from '@saulx/utils'
import { BasedClient as BasedClientOld } from '@based/client-old'
import { Duplex } from 'node:stream'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('fallback to old protocol - incoming', async (t: T) => {
  const client = new BasedClient()
  const clientOld = new BasedClientOld()
  const fnResult = 'STRING FOR BOYS'

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        myChannel: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          subscriber: (_, __, ___, update) => {
            let cnt = 1
            update({ cnt })
            const interval = setInterval(() => {
              cnt++
              update({ cnt })
            }, 10)
            return () => {
              clearInterval(interval)
            }
          },
        },
        derpi: {
          type: 'function',
          fn: async () => {
            return fnResult
          },
        },
        derpiJson: {
          type: 'function',
          fn: async () => {
            return { x: 1, y: 2 }
          },
        },
        derpiBuffer: {
          type: 'function',
          fn: async () => {
            const x = new Uint8Array(10)
            x.fill(66, 0)
            return x
          },
        },
        flap: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            const x = {
              derp: 66,
            }
            // 0 json
            // 1 string (simpler optmizes strings)
            update(x)
            // cache stuff , no compress etc etc
            const counter = setInterval(() => {
              x.derp++
              update(x)
            }, 10)
            return () => {
              clearInterval(counter)
            }
          },
        },
        hello: {
          type: 'stream',
          uninstallAfterIdleTime: 1,
          maxPayloadSize: 1e9,
          fn: async (_, { stream, payload, mimeType, size }) => {
            let cnt = 0
            stream.on('data', () => {
              cnt++
            })
            await readStream(stream)
            return { payload, cnt, mimeType, size }
          },
        },
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            var cnt = 1
            const x = new Uint8Array(1)
            x[0] = 66

            // 0 json
            // 1 string (simpler optmizes strings)
            update(x, cnt, false, undefined, undefined, 0, false)
            // cache stuff , no compress etc etc
            const counter = setInterval(() => {
              x[0] = x[0] + 1
              if (x[0] === 255) {
                x[0] = 0
              }
              cnt++
              update(x, cnt, false, undefined, undefined, 0, false)
            }, 10)
            return () => {
              clearInterval(counter)
            }
          },
        },
      },
    },
  })
  await server.start()

  // has to send the version in 1 byte
  client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  clientOld.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const obs1Results: any[] = []
  const obs2Results: any[] = []
  const bufResults: any[] = []

  const close = client
    .query('flap', {
      myQuery: 123,
    })
    .subscribe((d) => {
      obs1Results.push(d)
    })

  const close2 = clientOld
    .query('flap', {
      myQuery: 123,
    })
    .subscribe((d) => {
      obs2Results.push(d)
    })

  const close3 = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      bufResults.push(d)
    })

  await wait(100)
  close()
  close2()
  close3()

  t.deepEqual(obs1Results, obs2Results, 'obs results are equal')

  t.true(
    bufResults[0] instanceof Uint8Array,
    'bufResults gets read as unint8array',
  )

  t.deepEqual(await client.call('derpi'), fnResult, 'fn is correct new')
  t.deepEqual(await clientOld.call('derpi'), fnResult, 'fn is correct old')

  const channelNew = []
  const channelOld = []

  clientOld.channel('myChannel').subscribe((v) => {
    channelNew.push(v)
  })

  client.channel('myChannel').subscribe((v) => {
    channelOld.push(v)
  })

  t.deepEqual(channelNew, channelOld, 'channel results are equal')

  t.deepEqual(
    await (await fetch(t.context.http + '/derpi', {})).text(),
    fnResult,
    'http - function',
  )

  const x = await (await fetch(t.context.http + '/flap', {})).json()
  t.true(x.derp > 0, 'derp is large then 0 from flap')

  const bigBod: any[] = []
  for (let i = 0; i < 10000; i++) {
    bigBod.push({ flap: 'snurp', i })
  }
  const payload = Buffer.from(JSON.stringify(bigBod))
  let stream = new Duplex({
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

  stream = new Duplex({
    read() {},
    write(x) {
      this.push(x)
    },
  })
  index = 0

  streamBits()
  const s2 = await clientOld.stream('hello', {
    payload: { power: true },
    size: payload.byteLength,
    mimeType: 'pipo',
    contents: stream,
  })

  t.deepEqual(s, s2, 'stream fallback')
})
