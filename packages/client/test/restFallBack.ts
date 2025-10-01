import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'
import getPort from 'get-port'
import { encodeAuthState } from '@based/client'
import { inflateSync } from 'fflate'
import { concatUint8Arr, readUint32 } from '@based/utils'
import { FunctionClientType, genObserveId } from '@based/protocol/client-server'

// ----- src does not work
import { parseIncomingData } from '../src/incoming/parseIncomingData.js'
import { decodeHeader } from '../src/incoming/protocol.js'
import {
  encodeFunctionMessage,
  encodeObserveMessage,
} from '../src/outgoing/protocol.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('rest fallback', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        bla: {
          type: 'query',
          public: true,
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            update('?')
            return () => {}
          },
        },
        derp: {
          type: 'query',
          public: true,
          ctx: ['geo'],
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update, error, ctx) => {
            update('mep-' + ctx.geo.country)
            return () => {}
          },
        },
        hello: {
          type: 'function',
          public: true,
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            return 'flap'
          },
        },
      },
    },
  })
  await server.start()

  const rawResp = await (await fetch(t.context.http + '/based:rpstatus')).text()

  const authState = encodeAuthState({})
  const path = t.context.http + '/' + rawResp + '/' + authState

  const deflate = (
    start: number,
    end: number,
    isDeflate: boolean,
    buffer: Uint8Array,
  ): any => {
    return isDeflate
      ? inflateSync(buffer.slice(start, end))
      : buffer.subarray(start, end)
  }

  // ------------------------------------

  const fn = concatUint8Arr(encodeFunctionMessage([1, 'hello', {}]).buffers)

  const derp = await (
    await fetch(path, {
      method: 'post',
      // @ts-ignore
      body: fn,
      headers: {
        'content-length': String(fn.byteLength),
      },
    })
  ).arrayBuffer()

  let x = new Uint8Array(derp).slice(4)

  let { type, len, isDeflate } = decodeHeader(readUint32(x, 0))

  let payload: any

  if (type === FunctionClientType.function) {
    const start = 7
    const end = len + 4
    if (len !== 3) {
      payload = parseIncomingData(
        x[start],
        deflate(start + 1, end, isDeflate, x),
      )
    }
  }

  t.is(payload, 'flap')

  const blaId = genObserveId('bla', {})
  let query = concatUint8Arr(
    encodeObserveMessage(blaId, [1, 'bla', 0, {}]).buffers,
  )

  let derp2 = await (
    await fetch(path, {
      method: 'post',
      // @ts-ignore
      body: query,
      headers: {
        'content-length': String(query.byteLength),
      },
    })
  ).arrayBuffer()

  x = new Uint8Array(derp2).slice(4)
  let y = decodeHeader(readUint32(x, 0))
  type = y.type
  len = y.len
  isDeflate = y.isDeflate
  if (type === FunctionClientType.subscriptionData) {
    const start = 20
    const end = len + 4
    if (len !== 16) {
      const inflatedBuffer = isDeflate
        ? inflateSync(x.slice(start + 1, end))
        : x.subarray(start + 1, end)
      payload = parseIncomingData(x[start], inflatedBuffer)
    }
  }
  t.is(payload, '?')

  query = concatUint8Arr(
    encodeObserveMessage(blaId, [1, 'derp', 0, {}]).buffers,
  )
  derp2 = await (
    await fetch(path, {
      method: 'post',
      // @ts-ignore
      body: query,
      headers: {
        'content-length': String(query.byteLength),
      },
    })
  ).arrayBuffer()

  x = new Uint8Array(derp2).slice(4)
  y = decodeHeader(readUint32(x, 0))
  type = y.type
  len = y.len
  isDeflate = y.isDeflate
  if (type === FunctionClientType.subscriptionData) {
    const start = 20
    const end = len + 4
    if (len !== 16) {
      const inflatedBuffer = isDeflate
        ? inflateSync(x.slice(start + 1, end))
        : x.subarray(start + 1, end)
      payload = parseIncomingData(x[start], inflatedBuffer)
    }
  }
  t.is(payload, 'mep-unknown')

  await server.destroy()
})
