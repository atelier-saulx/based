import { BasedServer } from '../server'
import { BasedErrorCode, createError } from '../error'
import { Context, BasedDataStream, StreamPayload } from '@based/functions'
import { verifyRoute } from '../verifyRoute'
import { installFn } from '../installFn'
import { Duplex, Readable } from 'stream'

// maybe make a type pkg
export type StreamFunctionContents<F = Buffer | ArrayBuffer | string> = {
  contents: F
  payload?: any
  mimeType?: string
  fileName?: string
}

export type StreamFunctionStream =
  | {
      contents: Readable | Duplex
      payload?: any
      size: number
      mimeType?: string
      fileName?: string
      extension?: string
    }
  | {
      contents: BasedDataStream
      payload?: any
      size?: number
      mimeType?: string
      fileName?: string
      extension?: string
    }

export type StreamFunctionOpts = StreamFunctionContents | StreamFunctionStream

const isStreamFunctionOpts = (
  opts: StreamFunctionContents | StreamFunctionStream
): opts is StreamFunctionStream => {
  return opts.contents instanceof Duplex || opts.contents instanceof Readable
}

const wrapStream = (
  stream: BasedDataStream | Readable | Duplex,
  size: number
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
  streamOpts: StreamFunctionOpts
): Promise<any> => {
  const route = verifyRoute(
    server,
    server.client.ctx,
    'stream',
    server.functions.route(name),
    name
  )

  if (route === null) {
    return
  }

  const fn = await installFn(server, server.client.ctx, route)

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
  }

  try {
    return fn.function(server.client, file, ctx)
  } catch (err) {
    throw createError(server, ctx, BasedErrorCode.FunctionError, {
      route,
      err,
    })
  }
}
