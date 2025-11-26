import createDataStream from './createStream.js'
import { BasedServer } from '../../../../server.js'
import { sendError } from '../../../../sendError.js'
import getExtension from '../getExtension.js'
import { sendHttpResponse } from '../../../../sendHttpResponse.js'
import mimeTypes from 'mime-types'
import { authorize } from '../../../../authorize.js'
import type {
  BasedRoute,
  Context,
  HttpSession,
  StreamPayload,
} from '../../../../../functions/index.js'
import { parseQuery } from '../../../../../utils/index.js'
import { BasedErrorCode } from '../../../../../errors/index.js'

export const singleStream = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  route: BasedRoute<'stream'>,
  type: string,
  size: number,
) => {
  const session = ctx.session!
  const extension = session.req.getHeader('content-extension')
  const fileName = session.req.getHeader('content-name') || ''

  if (extension) {
    const mime = mimeTypes.lookup(extension)
    if (mime) {
      type = session.headers['content-type'] = mime
    }
  }

  const stream = createDataStream(server, route, ctx, size)

  let payload: any
  if ('query' in session) {
    try {
      payload = parseQuery(decodeURIComponent(session.query!))
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

  authorize({
    route,
    server,
    ctx,
    payload: streamPayload,
    error: () => {
      stream.destroy()
    },
  }).then(({ server, ctx, route, spec }) => {
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
}
