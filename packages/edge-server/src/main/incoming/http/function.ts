import { BasedServer } from '../../server'
import {
  BasedFunctionRoute,
  HttpClient,
  HttpMethod,
  isObservableFunctionSpec,
} from '../../../types'
import { sendHttpResponse } from '../../sendHttpResponse'
import { BasedErrorCode } from '../../../error'
import { sendError } from '../../sendError'
import { sendHttpFunction } from '../../worker'

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
        sendHttpFunction(
          server,
          method === 'post' ? HttpMethod.Post : HttpMethod.Get,
          client.context,
          spec,
          payload
        )
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
