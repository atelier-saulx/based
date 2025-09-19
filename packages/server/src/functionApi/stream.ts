import { BasedServer } from '../server.js'
import { createError } from '../error/index.js'
import {
  Context,
  BasedDataStream,
  StreamPayload,
  StreamFunctionOpts,
  isStreamFunctionOpts,
} from '@based/functions'
import { verifyRoute } from '../verifyRoute.js'
import { installFn } from '../installFn.js'
import { Duplex, Readable } from 'stream'
import { BasedErrorCode } from '@based/errors'

const wrapStream = (
  stream: BasedDataStream | Readable | Duplex,
  size: number,
): BasedDataStream => {
  if (stream instanceof BasedDataStream) {
    return stream
  }
  const s = new BasedDataStream(size)
  stream.pipe(s)
  return s
}

export const streamFunction = async (
  server: BasedServer,
  name: string,
  ctx: Context,
  streamOpts: StreamFunctionOpts,
): Promise<any> => {
  const route = verifyRoute(
    server,
    server.client.ctx,
    'stream',
    server.functions.route(name),
    name,
  )

  if (route === null) {
    return
  }

  const fn = await installFn({ server, ctx: server.client.ctx, route })

  if (!fn) {
    throw createError(server, ctx, BasedErrorCode.FunctionNotFound, {
      route,
    })
  }

  let file: StreamPayload

  if (isStreamFunctionOpts(streamOpts)) {
    const stream = wrapStream(streamOpts.contents, streamOpts.size)
    file = {
      stream,
      mimeType: streamOpts.mimeType || 'text/plain',
      fileName: streamOpts.fileName || '',
      size: streamOpts.size || stream.size,
      payload: streamOpts.payload,
    }
  } else {
    const contents = streamOpts.contents

    const buffer: Buffer =
      typeof contents === 'string'
        ? Buffer.from(contents)
        : contents instanceof ArrayBuffer
          ? Buffer.from(contents)
          : contents

    const stream = new BasedDataStream(buffer.byteLength)

    file = {
      stream,
      mimeType: streamOpts.mimeType || 'text/plain',
      fileName: streamOpts.fileName || '',
      size: stream.size,
      payload: streamOpts.payload,
    }

    process.nextTick(() => {
      stream.end(contents)
    })
  }

  try {
    return fn.fn(server.client, file, ctx)
  } catch (err) {
    throw createError(server, ctx, BasedErrorCode.FunctionError, {
      route,
      err,
    })
  }
}
