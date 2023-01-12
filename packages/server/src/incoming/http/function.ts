import { BasedServer } from '../../server'
import { BasedFunctionRoute, isObservableFunctionSpec } from '../../functions'
import { HttpSession, Context } from '../../context'
import { sendHttpResponse } from '../../sendHttpResponse'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'

export const httpFunction = (
  route: BasedFunctionRoute,
  ctx: Context<HttpSession>,
  server: BasedServer,
  payload?: Uint8Array
): void => {
  if (!ctx.session) {
    return
  }

  const name = route.name

  server.functions
    .install(name)
    .then((spec) => {
      if (!ctx.session) {
        return
      }
      if (spec && !isObservableFunctionSpec(spec)) {
        spec
          .function(payload, ctx)
          .then(async (result) => {
            if (!ctx.session) {
              return
            }
            if (
              spec.customHttpResponse &&
              (await spec.customHttpResponse(result, payload, ctx))
            ) {
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
    })
    .catch(() => sendError(server, ctx, BasedErrorCode.FunctionNotFound, route))
}
