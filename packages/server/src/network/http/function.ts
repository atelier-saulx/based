import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../types'
import { sendHttpError, sendHttpResponse } from './send'
import { BasedErrorCode } from '../../error'

export const httpFunction = (
  route: BasedFunctionRoute,
  payload: Uint8Array,
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

      // run and pass shared array buffer
      /*
       // spec
        //   .function(payload, client)
      */

      if (spec && !isObservableFunctionSpec(spec)) {
        server.functions
          .runFunction(spec, client, payload)
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
