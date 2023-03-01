import { BasedFunctionRoute, BasedFunctionSpec } from '../../functions'
import { HttpSession, SendHttpResponse } from '@based/functions'
import { sendHttpResponse } from '../../sendHttpResponse'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { IsAuthorizedHandler } from '../../authorize'

export const httpFunction: IsAuthorizedHandler<HttpSession> = async (
  route: BasedFunctionRoute,
  spec: BasedFunctionSpec,
  server,
  ctx,
  payload
) => {
  spec
    .function(server.client, payload, ctx)
    .then(async (result) => {
      if (!ctx.session) {
        return
      }
      if (spec.httpResponse) {
        const send: SendHttpResponse = (responseData, headers, status) => {
          if (!ctx.session) {
            return
          }
          if (!status) {
            sendHttpResponse(ctx, responseData, headers)
          } else {
            sendHttpResponse(
              ctx,
              responseData,
              headers,
              typeof status === 'string' ? status : String(status)
            )
          }
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
}
