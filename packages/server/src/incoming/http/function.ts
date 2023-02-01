import { BasedFunctionRoute } from '../../functions'
import { HttpSession } from '@based/functions'
import { sendHttpResponse } from '../../sendHttpResponse'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { installFn } from '../../installFn'
import { IsAuthorizedHandler } from '../../authorize'

export const httpFunction: IsAuthorizedHandler<HttpSession> = async (
  route: BasedFunctionRoute,
  server,
  ctx,
  payload
) => {
  installFn(server, ctx, route).then((spec) => {
    if (spec === null) {
      return
    }
    spec
      .function(server.client, payload, ctx)
      .then(async (result) => {
        if (!ctx.session) {
          return
        }
        if (
          /* change signature
            add (based, result, payload, ctx)
            based.send(ctx, {
              headers: {},
              payload
            }) ?
          */
          spec.customHttpResponse &&
          (await spec.customHttpResponse(
            result,
            payload,
            ctx,
            sendHttpResponse
          ))
        ) {
          // return
        }
        // sendHttpResponse(ctx, result)
      })
      .catch((err) => {
        sendError(server, ctx, BasedErrorCode.FunctionError, {
          err,
          route,
        })
      })
  })
}
