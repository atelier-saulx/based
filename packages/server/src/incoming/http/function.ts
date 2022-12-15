import { BasedServer } from '../../server'
import { BasedFunctionRoute, isObservableFunctionSpec } from '../../functions'
import { HttpClient } from '../../client'
import { sendHttpResponse } from '../../sendHttpResponse'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'

export const httpFunction = (
  method: string,
  route: BasedFunctionRoute,
  client: HttpClient,
  server: BasedServer,
  payload?: Uint8Array
): void => {
  if (!client.res) {
    return
  }
  const name = route.name
  server.functions
    .install(name)
    .then((spec) => {
      if (!client.res) {
        return
      }
      if (spec && !isObservableFunctionSpec(spec)) {
        spec
          .function(payload, client.context)
          .then(async (result) => {
            if (!client.res) {
              return
            }
            if (spec.customHttpResponse) {
              if (await spec.customHttpResponse(result, payload, client)) {
                return
              }
              sendHttpResponse(client, result)
            } else {
              sendHttpResponse(client, result)
            }
          })
          .catch((err) => {
            sendError(server, client, err.code, {
              err,
              route,
            })
          })
      }
    })
    .catch(() =>
      sendError(server, client, BasedErrorCode.FunctionNotFound, route)
    )
}
