import { BasedServer } from '../../../server.js'
import { sendError } from '../../../sendError.js'
import { multiPart } from './multiPart/index.js'
import { singleStream } from './stream/index.js'
import type {
  BasedRoute,
  Context,
  HttpSession,
} from '../../../../functions/index.js'
import { BasedErrorCode } from '../../../../errors/index.js'

export const httpStreamFunction = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  route: BasedRoute<'stream'>,
) => {
  if (!ctx.session) {
    return
  }
  const size = ctx.session.headers['content-length']!
  if (route.maxPayloadSize! > -1 && route.maxPayloadSize! < size) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, { route })
    return
  }
  const type = ctx.session.headers['content-type']!
  if (type && type.startsWith('multipart/form-data')) {
    multiPart(server, ctx, route)
    return
  }
  singleStream(server, ctx, route, type, size)
}
