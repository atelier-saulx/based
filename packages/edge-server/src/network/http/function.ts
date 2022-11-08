import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../types'
import { sendHttpError, sendHttpResponse } from './send'
import { BasedErrorCode } from '../../error'

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
        // TODO: way too much copy but this is tmp solution
        server.functions
          .runFunction(method === 'post' ? 3 : 4, spec, client.context, payload)
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
            sendHttpError(server, client, BasedErrorCode.FunctionError, {
              err,
              route,
            })
          })
      }
    })
    .catch(() =>
      sendHttpError(server, client, BasedErrorCode.FunctionNotFound, route)
    )
}
