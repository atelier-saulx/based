import createDataStream from './stream'
import { BasedServer } from '../../../server'
import { sendError } from '../../../sendError'
import {
  BasedFunctionRoute,
  HttpClient,
  isObservableFunctionSpec,
} from '../../../../types'
import { authorizeRequest } from '../authorize'
import { BasedErrorCode } from '../../../../error'
import multipartStream from './multipartStream'
import { sendHttpResponse } from '../../../sendHttpResponse'
import { sendStream } from '../../worker'

// copy stream and put in worker
// use atomics
// one block to stream into 512kb / 1 mb size?

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
          let fn = require(spec.functionPath)
          if (fn.default) {
            fn = fn.default
          }
          thisIsFn = fn
          if (files.length) {
            for (const file of files) {
              console.info('File parsed before fn / auth')
              file.resolve(fn(file.p, client.context))
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

  // may want to include authorize in the worker
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
          // clean this up - need to check if stream

          if (spec && !isObservableFunctionSpec(spec) && spec.stream) {
            console.info('Lets go ham WORKER ATOMICSSSS')

            sendStream()

            // // const stream = createDataStream(server, route, client, size)
            // const streamPayload = { payload, stream }
            // let fn = require(spec.functionPath)
            // if (fn.default) {
            //   fn = fn.default
            // }
            // fn(streamPayload, client.context)
            //   .catch((err) => {
            //     stream.destroy()
            //     sendError(server, client, BasedErrorCode.FunctionError, {
            //       err,
            //       route,
            //     })
            //   })
            //   .then((r) => {
            //     if (
            //       stream.readableEnded ||
            //       stream.listenerCount('data') === 0
            //     ) {
            //       sendHttpResponse(client, r)
            //     } else {
            //       stream.on('end', () => {
            //         sendHttpResponse(client, r)
            //       })
            //     }
            //   })
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
