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
    sendHttpError(client, BasedErrorCode.InvalidPayload, 'Payload Too Large', {
      code: 413,
    })
    // sendHttpError(client, 'Payload Too Large', 413)
    return
  }

  const stream = createDataStream(client, size)

  const streamPayload = { payload, stream }

  // destroy stream from context as well....

  console.log('go go go')

  authorizeRequest(
    server,
    client,
    streamPayload,
    route,
    (payload) => {
      server.functions
        .install(route.name)
        .then((spec) => {
          console.log('hello', route.name)
          if (spec && !isObservableFunctionSpec(spec) && spec.stream) {
            spec
              .function(payload, client)
              .catch((err) => {
                stream.destroy()
                sendHttpError(client, BasedErrorCode.FunctionError, {
                  err,
                  name: route.name,
                })
              })
              .then(() => {
                // function finished - dont really know what to do here :D
              })
          } else {
            stream.destroy()
            sendHttpError(client, BasedErrorCode.FunctionNotFound, route.name)
          }
        })
        .catch(() => {
          stream.destroy()
          sendHttpError(client, BasedErrorCode.FunctionNotFound, route.name)
        })
    },
    () => stream.destroy()
  )
}
