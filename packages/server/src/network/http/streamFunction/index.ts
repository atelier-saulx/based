import createDataStream from './stream'
import { BasedServer } from '../../../server'
import { sendHttpError } from '../send'
import {
  BasedFunctionRoute,
  HttpClient,
  isObservableFunctionSpec,
} from '../../../types'
import { authorizeRequest } from '../authorize'
import { BasedErrorCode } from '../../../error'
import multipartStream from './multipartStream'

export const httpStreamFunction = (
  server: BasedServer,
  client: HttpClient,
  payload: any,
  route: BasedFunctionRoute
) => {
  if (!client.res) {
    return
  }

  const size = client.context.headers['content-length']

  if (route.maxPayloadSize > -1 && route.maxPayloadSize < size) {
    sendHttpError(client, BasedErrorCode.PayloadTooLarge)
    return
  }

  const type = client.context.headers['content-type']

  if (type && type.startsWith('multipart/form-data')) {
    authorizeRequest(server, client, payload, route, (payload) => {
      server.functions
        .install(route.name)
        .then((spec) => {
          if (spec && !isObservableFunctionSpec(spec) && spec.stream) {
            multipartStream(client, payload, spec)
          } else {
            sendHttpError(client, BasedErrorCode.FunctionNotFound, route.name)
          }
        })
        .catch(() => {
          sendHttpError(client, BasedErrorCode.FunctionNotFound, route.name)
        })
    })
    return
  }

  // destroy stream from context
  authorizeRequest(server, client, payload, route, (payload) => {
    server.functions
      .install(route.name)
      .then((spec) => {
        if (spec && !isObservableFunctionSpec(spec) && spec.stream) {
          const stream = createDataStream(client, size)

          const streamPayload = { payload, stream }

          spec
            .function(streamPayload, client)
            .catch((err) => {
              sendHttpError(client, BasedErrorCode.FunctionError, {
                err,
                name: route.name,
              })
            })
            .then(() => {
              // function finished - dont really know what to do here :D
            })
        } else {
          sendHttpError(client, BasedErrorCode.FunctionNotFound, route.name)
        }
      })
      .catch(() => {
        sendHttpError(client, BasedErrorCode.FunctionNotFound, route.name)
      })
  })
}
