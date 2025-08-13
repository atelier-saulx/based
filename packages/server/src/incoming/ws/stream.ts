import { BinaryMessageHandler } from './types.js'
import {
  decodePayload,
  decodeName,
  encodeStreamFunctionResponse,
  valueToBuffer,
  encodeStreamFunctionChunkResponse,
  valueToBufferV1,
} from '../../protocol.js'
import { BasedDataStream } from '@based/functions'
import mimeTypes from 'mime-types'
import { authorize, IsAuthorizedHandler } from '../../authorize.js'
import { verifyRoute } from '../../verifyRoute.js'
import { rateLimitRequest } from '../../security.js'
import { WebSocketSession, BasedRoute } from '@based/functions'
import { sendError } from '../../sendError.js'
import { BasedErrorCode } from '@based/errors'
import zlib from 'node:zlib'
import { BasedServer } from '../../server.js'
import { readUint64, readUint24, readUint32 } from '@based/utils'

const startStreamFunction: IsAuthorizedHandler<
  WebSocketSession,
  BasedRoute<'stream'>
> = (route, spec, server, ctx, payload, streamRequestId) => {
  spec
    .fn(server.client, payload, ctx)
    .then(async (v) => {
      ctx.session?.ws.send(
        encodeStreamFunctionResponse(
          streamRequestId,
          ctx.session.v < 2 ? valueToBufferV1(v, true) : valueToBuffer(v, true),
        ),
        true,
        false,
      )
    })
    .catch((err) => {
      sendError(server, ctx, BasedErrorCode.FunctionError, {
        route,
        streamRequestId,
        err,
      })
    })
}

export const registerStream: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server,
) => {
  // | 4 header | 1 subType = 1 | 3 reqId | 4 content-size | 1 nameLen | 1 mimeLen | 1 fnNameLen | 1 extensionLength | name | mime | fnName | extension | payload
  if (!ctx.session) {
    return false
  }

  const infoLen = 16

  const reqId = readUint24(arr, start + 5)

  if (reqId === undefined) {
    return false
  }

  if (ctx.session.streams?.[reqId]) {
    return false
  }

  const contentSize = readUint32(arr, start + 8)

  if (!contentSize) {
    return false
  }

  const nameLen = arr[start + 12]
  const mimeLen = arr[start + 13]
  const fnNameLen = arr[start + 14]
  const extensionLen = arr[start + 15]

  const name = decodeName(arr, start + infoLen, start + infoLen + nameLen)

  let mime = decodeName(
    arr,
    start + infoLen + nameLen,
    start + infoLen + nameLen + mimeLen,
  )
  const fnName = decodeName(
    arr,
    start + infoLen + nameLen + mimeLen,
    start + infoLen + mimeLen + nameLen + fnNameLen,
  )
  let extension = decodeName(
    arr,
    start + infoLen + nameLen + mimeLen + fnNameLen,
    start + infoLen + mimeLen + nameLen + fnNameLen + extensionLen,
  )

  const route = verifyRoute(
    server,
    ctx,
    'stream',
    server.functions.route(fnName),
    fnName,
    reqId,
  )

  // TODO: add strictness setting - if strict return false here
  if (route === null) {
    return true
  }

  if (
    rateLimitRequest(server, ctx, route.rateLimitTokens, server.rateLimit.ws)
  ) {
    ctx.session.ws.close()
    return false
  }

  const payload =
    len === nameLen + infoLen + mimeLen + extensionLen
      ? undefined
      : decodePayload(
          new Uint8Array(
            arr.slice(
              start + infoLen + nameLen + mimeLen + fnNameLen + extensionLen,
              start + len,
            ),
          ),
          isDeflate,
          ctx.session.v < 2,
        )

  if (!ctx.session.streams) {
    ctx.session.streams = {}
  }

  if (!mime) {
    if (extension) {
      const mimeLookup = mimeTypes.lookup(extension)
      if (mimeLookup) {
        mime = mimeLookup
      }
    } else {
      const e = name.split('.')
      const extension = e[e.length - 1]
      if (name) {
        const t = mimeTypes.lookup(extension)
        if (t) {
          mime = t
        }
      } else {
        mime = '*/*'
      }
    }
  }

  if (!extension) {
    extension = mimeTypes.extension(mime) || ''
  }

  const streamPayload = {
    fileName: name,
    mimeType: mime,
    size: contentSize,
    extension,
    fn: fnName,
    payload,
    stream: new BasedDataStream(contentSize),
    seqId: 0,
  }

  ctx.session.streams[reqId] = streamPayload

  authorize(
    route,
    server,
    ctx,
    streamPayload,
    startStreamFunction,
    reqId,
    undefined,
    route.public,
    () => {
      if (!ctx.session) {
        return
      }
      delete ctx.session.streams[reqId]
    },
  )

  return true
}

const getMaxChunkSize = (server: BasedServer): number => {
  return 0
}

// add counter for active streams

export const receiveChunkStream: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server,
) => {
  // Type 7.2 Chunk
  // | 4 header | 1 subType = 2 | 3 reqId | 1 seqId | content
  if (!ctx.session) {
    return false
  }

  const infoLen = 9
  const reqId = readUint24(arr, start + 5)
  const seqId = arr[start + 8]

  if (reqId === undefined) {
    return false
  }

  const streamPayload = ctx.session.streams?.[reqId]

  if (!streamPayload) {
    return false
  }

  if (seqId - 1 !== streamPayload.seqId) {
    const sRoute: BasedRoute<'stream'> = {
      name: 'stream-chunk',
      type: 'stream',
    }
    sendError(server, ctx, BasedErrorCode.FunctionError, {
      route: sRoute,
      streamRequestId: reqId,
      err: `Chunk is out of order
- current chunk #${seqId}, 
- previous chunk #${streamPayload.seqId}`,
    })
    console.log('ERROR chunky')
    streamPayload.stream.destroy()
    delete ctx.session.streams[reqId]
    // maybe return false... (something is wrong)
    return true
  }

  streamPayload.seqId = seqId === 255 ? 0 : seqId

  // encoding can still be a thing for streams test with png's

  const chunk = !isDeflate
    ? arr.slice(infoLen + start, start + len)
    : zlib.inflateRawSync(arr.slice(infoLen + start, start + len))

  if (streamPayload.stream.paused) {
    streamPayload.stream.once('resume', () => {
      if (!ctx.session) {
        streamPayload.stream.destroy()
        return false
      }
      if (
        streamPayload.stream.receivedBytes + chunk.byteLength ===
        streamPayload.size
      ) {
        streamPayload.stream.end(chunk)
        ctx.session.ws.send(
          encodeStreamFunctionChunkResponse(
            reqId,
            seqId,
            1,
            getMaxChunkSize(server),
          ),
          true,
          false,
        )
      } else {
        streamPayload.stream.write(chunk)
        ctx.session.ws.send(
          encodeStreamFunctionChunkResponse(
            reqId,
            seqId,
            0,
            getMaxChunkSize(server),
          ),
          true,
          false,
        )
      }
    })
  } else {
    streamPayload.stream.write(chunk)
    if (streamPayload.stream.receivedBytes === streamPayload.size) {
      ctx.session.ws.send(
        encodeStreamFunctionChunkResponse(
          reqId,
          seqId,
          1,
          getMaxChunkSize(server),
        ),
        true,
        false,
      )
      streamPayload.stream.end()
    } else {
      ctx.session.ws.send(
        encodeStreamFunctionChunkResponse(
          reqId,
          seqId,
          0,
          getMaxChunkSize(server),
        ),
        true,
        false,
      )
    }
  }

  return true
}
