import { BasedServer } from '../server'
import { BasedErrorCode, createError } from '../error'
import { Context, BasedDataStream } from '@based/functions'
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

export type StreamFunctionStream = {
  contents: BasedDataStream | Readable | Duplex
  payload?: any
  size: number
  mimeType?: string
  fileName?: string
  extension?: string
}

export type StreamFunctionOpts = StreamFunctionContents | StreamFunctionStream

//  payload parsing

// lots of thins here...
export const stream = async (
  server: BasedServer,
  name: string,
  ctx: Context,
  payload: any
): Promise<any> => {
  const route = verifyRoute(
    server,
    server.client.ctx,
    'fn',
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

  try {
    return fn.function(server.client, payload, ctx)
  } catch (err) {
    throw createError(server, ctx, BasedErrorCode.FunctionError, {
      route,
      err,
    })
  }
}
