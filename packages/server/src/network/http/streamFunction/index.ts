import createDataStream from './stream'
import { BasedServer } from '../../../server'
import { sendHttpError, sendHttpResponse } from '../send'
import {
  BasedFunctionRoute,
  HttpClient,
  isObservableFunctionSpec,
} from '../../../types'
import { authorizeRequest } from '../authorize'
import { BasedErrorCode } from '../../../error'
import multipartStream from './multipartStream'

// TODO: move to workers....

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
    sendHttpError(server, client, BasedErrorCode.PayloadTooLarge, route)
    return
  }

  const type = client.context.headers['content-type']

  // replace this with transder encoding 'chunked'
  if (type && type.startsWith('multipart/form-data')) {
    authorizeRequest(server, client, payload, route, (payload) => {
      server.functions
        .install(route.name)
        .then((spec) => {
          if (spec && !isObservableFunctionSpec(spec) && spec.stream) {
            multipartStream(client, server, payload, route, spec)
          } else {
            sendHttpError(
              server,
              client,
              BasedErrorCode.FunctionNotFound,
              route
            )
          }
        })
        .catch(() => {
          sendHttpError(server, client, BasedErrorCode.FunctionNotFound, route)
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
          const stream = createDataStream(server, route, client, size)
          const streamPayload = { payload, stream }
          let fn = require(spec.functionPath)
          if (fn.default) {
            fn = fn.default
          }
          fn(streamPayload, client.context)
            .catch((err) => {
              stream.destroy()
              sendHttpError(server, client, BasedErrorCode.FunctionError, {
                err,
                name: route.name,
              })
            })
            .then((r) => {
              if (stream.readableEnded) {
                sendHttpResponse(client, r)
              } else {
                stream.once('end', () => {
                  sendHttpResponse(client, r)
                })
              }
            })
        } else {
          sendHttpError(server, client, BasedErrorCode.FunctionNotFound, route)
        }
      })
      .catch(() => {
        sendHttpError(server, client, BasedErrorCode.FunctionNotFound, route)
      })
  })
}
