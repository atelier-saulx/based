import createDataStream from './stream'
import { BasedServer } from '../../../server'
import { sendError } from '../../../sendError'
import {
  BasedFunctionRoute,
  isObservableFunctionSpec,
} from '../../../functions'
import { HttpClient } from '../../../client'
import { authorizeRequest } from '../authorize'
import { BasedErrorCode } from '../../../error'
import multipartStream from './multipartStream'
import { sendHttpResponse } from '../../../sendHttpResponse'

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
    sendError(server, client, BasedErrorCode.PayloadTooLarge, route)
    return
  }

  const type = client.context.headers['content-type']

  // replace this with transder encoding 'chunked'
  if (type && type.startsWith('multipart/form-data')) {
    const files: any[] = []
    let thisIsFn: Function

    multipartStream(client, server, payload, route, (p) => {
      return new Promise((resolve) => {
        authorizeRequest(
          server,
          client,
          p.payload,
          route,
          () => {
            if (!thisIsFn) {
              files.push({ p, resolve })
            } else {
              resolve(thisIsFn(p, client.context))
            }
          },
          () => {
            resolve(undefined)
          }
        )
      })
    })

    server.functions
      .install(route.name)
      .then((spec) => {
        if (spec && !isObservableFunctionSpec(spec) && spec.stream) {
          thisIsFn = spec.function
          if (files.length) {
            for (const file of files) {
              console.info('File parsed before fn / auth')
              file.resolve(thisIsFn(file.p, client.context))
            }
          }
        } else {
          sendError(server, client, BasedErrorCode.FunctionNotFound, route)
        }
      })
      .catch(() => {
        sendError(server, client, BasedErrorCode.FunctionNotFound, route)
      })

    return
  }

  const stream = createDataStream(server, route, client, size)

  // destroy stream from context
  authorizeRequest(
    server,
    client,
    payload,
    route,
    (payload) => {
      server.functions
        .install(route.name)
        .then((spec) => {
          if (spec && !isObservableFunctionSpec(spec) && spec.stream) {
            // const stream = createDataStream(server, route, client, size)
            const streamPayload = { payload, stream }

            const fn = spec.function

            fn(streamPayload, client.context)
              .catch((err) => {
                stream.destroy()
                sendError(server, client, BasedErrorCode.FunctionError, {
                  err,
                  route,
                })
              })
              .then((r) => {
                if (
                  stream.readableEnded ||
                  stream.listenerCount('data') === 0
                ) {
                  sendHttpResponse(client, r)
                } else {
                  stream.on('end', () => {
                    sendHttpResponse(client, r)
                  })
                }
              })
          } else {
            sendError(server, client, BasedErrorCode.FunctionNotFound, route)
          }
        })
        .catch((err) => {
          console.error(err)
          sendError(server, client, BasedErrorCode.FunctionNotFound, route)
        })
    },
    () => {
      stream.destroy()
    }
  )
}