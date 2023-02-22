import { BasedFunctionRoute } from '../../functions'
import { HttpSession, SendHttpResponse } from '@based/functions'
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

        if (spec.httpResponse) {
          const send: SendHttpResponse = (responseData, headers, status) => {
            sendHttpResponse(
              ctx,
              responseData,
              headers,
              status !== undefined
                ? typeof status === 'string'
                  ? status
                  : String(status)
                : undefined
            )
          }
          await spec.httpResponse(server.client, payload, result, send, ctx)
          return
        }

        sendHttpResponse(ctx, result)
      })
      .catch((err) => {
        sendError(server, ctx, BasedErrorCode.FunctionError, {
          err,
          route,
        })
      })
  })
}
