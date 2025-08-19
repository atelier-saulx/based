import createDataStream from './createStream.js'
import { BasedServer } from '../../../../server.js'
import { sendError } from '../../../../sendError.js'
import getExtension from '../getExtension.js'
import {
  HttpSession,
  Context,
  StreamPayload,
  BasedRoute,
} from '@based/functions'
import { BasedErrorCode } from '@based/errors'
import { sendHttpResponse } from '../../../../sendHttpResponse.js'
import mimeTypes from 'mime-types'
import { parseQuery } from '@based/utils'
import { installFn } from '../../../../installFn.js'
import { authorize } from '../../../../authorize.js'

export const singleStream = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  route: BasedRoute<'stream'>,
  type: string,
  size: number,
) => {
  const extension = ctx.session.req.getHeader('content-extension')
  const fileName = ctx.session.req.getHeader('content-name') || ''

  if (extension) {
    const mime = mimeTypes.lookup(extension)
    if (mime) {
      type = ctx.session.headers['content-type'] = mime
    }
  }

  const stream = createDataStream(server, route, ctx, size)

  let payload: any
  if ('query' in ctx.session) {
    try {
      payload = parseQuery(decodeURIComponent(ctx.session.query))
    } catch (err) {}
  }

  const streamPayload: StreamPayload = {
    payload,
    stream,
    size,
    mimeType: type,
    fileName,
    extension: getExtension(type) || '',
  }

  authorize(
    route,
    server,
    ctx,
    streamPayload,
    () => {
      installFn(server, ctx, route).then((spec) => {
        if (spec === null) {
          stream.destroy()
          return
        }
        const fn = spec.fn
        fn(server.client, streamPayload, ctx)
          .catch((err) => {
            sendError(server, ctx, BasedErrorCode.FunctionError, {
              err,
              route,
            })
          })
          .then((r) => {
            if (stream.readableEnded || stream.listenerCount('data') === 0) {
              sendHttpResponse(ctx, r)
            } else {
              stream.on('end', () => {
                sendHttpResponse(ctx, r)
              })
            }
          })
      })
    },
    undefined,
    undefined,
    false,
    () => {
      stream.destroy()
    },
  )
}
