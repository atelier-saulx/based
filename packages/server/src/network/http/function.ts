import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../types'
import { sendHttpError, sendHttpResponse } from './send'
import { BasedErrorCode } from '../../error'

export const httpFunction = (
  route: BasedFunctionRoute,
  payload: any,
  client: HttpClient,
  server: BasedServer
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
          .function(payload, client)
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
            sendHttpError(client, BasedErrorCode.FunctionError, {
              err,
              name,
            })
          })
      }
    })
    .catch(() =>
      sendHttpError(client, BasedErrorCode.FunctionNotFound, { name })
    )
}
