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
        server.auth.config
          .authorize(server, client, name, payload)
          .then((ok) => {
            if (!client.res) {
              return
            }
            if (!ok) {
              sendHttpError(
                client,
                BasedErrorCode.AuthorizeRejectedError,
                `${name} unauthorized request`
              )
              // sendHttpError(
              //   client,
              //   `${name} unauthorized request`,
              //   401,
              //   'Unauthorized'
              // )
            } else {
              spec
                .function(payload, client)
                .then(async (result) => {
                  if (!client.res) {
                    return
                  }
                  if (spec.customHttpResponse) {
                    if (
                      await spec.customHttpResponse(result, payload, client)
                    ) {
                      return
                    }
                    sendHttpResponse(client, result)
                  } else {
                    sendHttpResponse(client, result)
                  }
                })
                .catch((err) => {
                  sendHttpError(
                    client,
                    BasedErrorCode.FunctionError,
                    err.message
                  )
                  // sendHttpError(client, err.message)
                })
            }
          })
          .catch(
            (err) =>
              sendHttpError(
                client,
                BasedErrorCode.AuthorizeRejectedError,
                err.message
              )
            // sendHttpError(client, err.message, 401, 'Unauthorized')
          )
      } else if (spec && isObservableFunctionSpec(spec)) {
        sendHttpError(
          client,
          BasedErrorCode.FunctionNotFound,
          `function is observable - use /get/${name} instead`
        )
        // sendHttpError(
        //   client,
        //   `function is observable - use /get/${name} instead`,
        //   404,
        //   'Not Found'
        // )
      } else {
        sendHttpError(
          client,
          BasedErrorCode.FunctionNotFound,
          `function does not exist ${name}`
        )
        // sendHttpError(
        //   client,
        //   `function does not exist ${name}`,
        //   404,
        //   'Not Found'
        // )
      }
    })
    .catch(
      () =>
        sendHttpError(
          client,
          BasedErrorCode.FunctionNotFound,
          `function does not exist ${name}`
        )
      // sendHttpError(client, `function does not exist ${name}`, 404, 'Not Found')
    )
}
