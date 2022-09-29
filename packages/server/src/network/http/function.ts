import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../types'
import { sendHttpError, sendHttpResponse } from './send'

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
                `${name} unauthorized request`,
                401,
                'Unauthorized'
              )
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
                  sendHttpError(client, err.message)
                })
            }
          })
          .catch((err) =>
            sendHttpError(client, err.message, 401, 'Unauthorized')
          )
      } else if (spec && isObservableFunctionSpec(spec)) {
        sendHttpError(
          client,
          `function is observable - use /get/${name} instead`,
          404,
          'Not Found'
        )
      } else {
        sendHttpError(
          client,
          `function does not exist ${name}`,
          404,
          'Not Found'
        )
      }
    })
    .catch(() =>
      sendHttpError(client, `function does not exist ${name}`, 404, 'Not Found')
    )
}
