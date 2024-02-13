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

const startStream: IsAuthorizedHandler<
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
  // | 4 header | 1 subType = 1 | 3 reqId | 4 content-size | 1 nameLen | 1 mimeLen | 1 fnNameLen | name | mime | fnName | payload
  if (!ctx.session) {
    return false
  }

  const infoLen = 15

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
    len === nameLen + infoLen + mimeLen
      ? undefined
      : parsePayload(
          decodePayload(
            new Uint8Array(
              arr.slice(
                start + infoLen + nameLen + mimeLen + fnNameLen,
                start + len
              )
            ),
            isDeflate
          )
        )

  if (!ctx.session.streams) {
    ctx.session.streams = {}
  }

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

  streamPayload.stream.on('pause', () => {
    console.info('ITS PAUSED!')
    // @ts-ignore
    streamPayload.stream.isPaused = true
  })

  streamPayload.stream.on('resume', () => {
    console.info('RESUME')
    // @ts-ignore
    streamPayload.stream.isPaused = false
  })

  ctx.session.streams[reqId] = streamPayload

  authorize(
    route,
    server,
    ctx,
    streamPayload,
    startStream,
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

  // think about this
  // if (rateLimitRequest(server, ctx, 1, server.rateLimit.ws)) {
  //   ctx.session.ws.close()
  //   return false
  // }

  if (seqId - 1 !== streamPayload.seqId) {
    const sRoute: BasedRoute<'stream'> = {
      name: 'stream-chunk',
      type: 'stream',
    }

    sendError(server, ctx, BasedErrorCode.FunctionError, {
      route: sRoute,
      streamRequestId: reqId,
      err: `SeqId out of current seq ${seqId} prev seq ${streamPayload.seqId}`,
    })

    return true
  }

  streamPayload.seqId = seqId === 255 ? -1 : seqId

  // console.log('hallo write', seqId)

  const chunk = !isDeflate
    ? arr.slice(infoLen + start, start + len)
    : zlib.inflateRawSync(arr.slice(infoLen + start, start + len))

  // console.log('WRITE')

  // @ts-ignore
  if (streamPayload.stream.isPaused) {
    streamPayload.stream.once('resume', () => {
      console.info('ITS resu,es!')

      streamPayload.stream.write(chunk)

      // console.log(streamPayload.stream.)

      ctx.session.ws.send(
        encodeStreamFunctionChunkResponse(reqId, seqId, 0),
        true,
        false
      )

      if (streamPayload.stream.receivedBytes === streamPayload.size) {
        streamPayload.stream.end()
      }
    })
  } else {
    streamPayload.stream.write(chunk)

    // console.log(streamPayload.stream.)

    ctx.session.ws.send(
      encodeStreamFunctionChunkResponse(reqId, seqId, 0),
      true,
      false
    )

    if (streamPayload.stream.receivedBytes === streamPayload.size) {
      streamPayload.stream.end()
    }
  }

  return true
}
