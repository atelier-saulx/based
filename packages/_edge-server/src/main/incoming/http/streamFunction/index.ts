import createDataStream from './_stream'
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
import stream from './stream'

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
              // now this has to go to worker or the total parsing as well
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

  console.info('normal shit...')
  // this is different payload...
  stream(server, client, route, payload)
}
