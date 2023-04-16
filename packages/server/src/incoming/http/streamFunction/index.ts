import { BasedServer } from '../../../server'
import { sendError } from '../../../sendError'
import { HttpSession, Context, BasedRoute } from '@based/functions'
import { BasedErrorCode } from '../../../error'
import { multiPart } from './multiPart'
import { singleStream } from './stream'

export const httpStreamFunction = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  route: BasedRoute<'stream'>
) => {
  console.info('lullz222', route)

  if (!ctx.session) {
    return
  }
  const size = ctx.session.headers['content-length']
  if (route.maxPayloadSize > -1 && route.maxPayloadSize < size) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, { route })
    return
  }
  const type = ctx.session.headers['content-type']
  if (type && type.startsWith('multipart/form-data')) {
    multiPart(server, ctx, route)
    return
  }
  singleStream(server, ctx, route, type, size)
}
