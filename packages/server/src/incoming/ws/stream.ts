import { BinaryMessageHandler } from './types.js'
import {
  decodePayload,
  decodeName,
  readUint8,
  parsePayload,
  encodeStreamFunctionResponse,
  valueToBuffer,
  encodeStreamFunctionChunkResponse,
} from '../../protocol.js'
import { BasedDataStream } from '@based/functions'
import mimeTypes from 'mime-types'
import { authorize, IsAuthorizedHandler } from '../../authorize.js'
import { verifyRoute } from '../../verifyRoute.js'
import { rateLimitRequest } from '../../security.js'
import { WebSocketSession, BasedRoute } from '@based/functions'
import { sendError } from '../../sendError.js'
import { BasedErrorCode } from '../../error/index.js'
import zlib from 'node:zlib'

const startStreamFunction: IsAuthorizedHandler<
  WebSocketSession,
  BasedRoute<'stream'>
> = (route, spec, server, ctx, payload, streamRequestId) => {
  spec
    .fn(server.client, payload, ctx)
    .then(async (v) => {
      ctx.session?.ws.send(
        encodeStreamFunctionResponse(streamRequestId, valueToBuffer(v)),
        true,
        false
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
  server
) => {
  // | 4 header | 1 subType = 1 | 3 reqId | 4 content-size | 1 nameLen | 1 mimeLen | 1 fnNameLen | 1 extensionLength | name | mime | fnName | extension | payload
  if (!ctx.session) {
    return false
  }

  const infoLen = 16

  const reqId = readUint8(arr, start + 5, 3)

  if (reqId === undefined) {
    return false
  }

  if (ctx.session.streams?.[reqId]) {
    return false
  }

  const contentSize = readUint8(arr, start + 8, 4)

  if (!contentSize) {
    return false
  }

  const nameLen = readUint8(arr, start + 12, 1)
  const mimeLen = readUint8(arr, start + 13, 1)
  const fnNameLen = readUint8(arr, start + 14, 1)
  const extensionLen = readUint8(arr, start + 15, 1)

  const name = decodeName(arr, start + infoLen, start + infoLen + nameLen)
  let mime = decodeName(
    arr,
    start + infoLen + nameLen,
    start + infoLen + nameLen + mimeLen
  )
  const fnName = decodeName(
    arr,
    start + infoLen + nameLen + mimeLen,
    start + infoLen + mimeLen + nameLen + fnNameLen
  )
  let extension = decodeName(
    arr,
    start + infoLen + nameLen + mimeLen + fnNameLen,
    start + infoLen + mimeLen + nameLen + fnNameLen + extensionLen
  )

  const route = verifyRoute(
    server,
    ctx,
    'stream',
    server.functions.route(fnName),
    fnName,
    reqId
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
      : parsePayload(
          decodePayload(
            new Uint8Array(
              arr.slice(
                start + infoLen + nameLen + mimeLen + fnNameLen + extensionLen,
                start + len
              )
            ),
            isDeflate
          )
        )

  if (!ctx.session.streams) {
    ctx.session.streams = {}
  }

  /*
 if (extension) {
    const mime = mimeTypes.lookup(extension)
    if (mime) {
      type = ctx.session.headers['content-type'] = mime
    }
  }
  */

  if (!mime) {
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

  const streamPayload = {
    fileName: name,
    mimeType: mime,
    size: contentSize,
    extension: mimeTypes.extension(mime) || '',
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
      console.log('not authorized...')
      delete ctx.session.streams[reqId]
    }
  )

  return true
}

export const receiveChunkStream: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server
) => {
  // Type 7.2 Chunk
  // | 4 header | 1 subType = 2 | 3 reqId | 1 seqId | content
  if (!ctx.session) {
    return false
  }

  const infoLen = 9
  const reqId = readUint8(arr, start + 5, 3)
  const seqId = readUint8(arr, start + 8, 1)

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
      err: `SeqId out of order: ${seqId} prev seq ${streamPayload.seqId}`,
    })
    streamPayload.stream.destroy()
    delete ctx.session.streams[reqId]
    // maybe return false... (something is wrong)
    return true
  }

  streamPayload.seqId = seqId === 255 ? -1 : seqId

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
          encodeStreamFunctionChunkResponse(reqId, seqId, 1),
          true,
          false
        )
      } else {
        streamPayload.stream.write(chunk)
        ctx.session.ws.send(
          encodeStreamFunctionChunkResponse(reqId, seqId, 0),
          true,
          false
        )
      }
    })
  } else {
    streamPayload.stream.write(chunk)
    if (streamPayload.stream.receivedBytes === streamPayload.size) {
      ctx.session.ws.send(
        encodeStreamFunctionChunkResponse(reqId, seqId, 1),
        true,
        false
      )
      streamPayload.stream.end()
    } else {
      ctx.session.ws.send(
        encodeStreamFunctionChunkResponse(reqId, seqId, 0),
        true,
        false
      )
    }
  }

  return true
}
