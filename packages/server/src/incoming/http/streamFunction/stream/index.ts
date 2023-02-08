import createDataStream from './createStream'
import { BasedServer } from '../../../../server'
import { sendError } from '../../../../sendError'
import getExtension from '../getExtension'
import { BasedStreamFunctionRoute } from '../../../../functions'
import { HttpSession, Context, StreamPayload } from '@based/functions'
import { BasedErrorCode } from '../../../../error'
import { sendHttpResponse } from '../../../../sendHttpResponse'
import mimeTypes from 'mime-types'
import { parseQuery } from '@saulx/utils'
import { installFn } from '../../../../installFn'
import { authorize } from '../../../../authorize'

export const singleStream = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  route: BasedStreamFunctionRoute,
  type: string,
  size: number
) => {
  const extension = ctx.session.req.getHeader('content-extension')
  const fileName = ctx.session.req.getHeader('content-name')

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
    payload,
    () => {
      installFn(server, ctx, route).then((spec) => {
        if (spec === null) {
          stream.destroy()
          return
        }
        const fn = spec.function
        fn(server.client, streamPayload, ctx)
          .catch((err) => {
            // stream.destroy()
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
    () => {
      stream.destroy()
    }
  )
}
