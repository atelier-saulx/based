import createDataStream from './stream'
import { BasedServer } from '../../../server'
import { sendError } from '../../../sendError'
import {
  BasedFunctionRoute,
  isObservableFunctionSpec,
} from '../../../functions'
import { HttpSession, Context } from '../../../context'
import { authorizeRequest } from '../authorize'
import { BasedErrorCode } from '../../../error'
import multipartStream from './multipartStream'
import { sendHttpResponse } from '../../../sendHttpResponse'

export const httpStreamFunction = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  payload: any,
  route: BasedFunctionRoute
) => {
  if (!ctx.session) {
    return
  }

  const size = ctx.session.headers['content-length']

  if (route.maxPayloadSize > -1 && route.maxPayloadSize < size) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, route)
    return
  }

  const type = ctx.session.headers['content-type']

  // replace this with transder encoding 'chunked'
  if (type && type.startsWith('multipart/form-data')) {
    const files: any[] = []
    let thisIsFn: Function

    multipartStream(ctx, server, payload, route, (p) => {
      return new Promise((resolve) => {
        authorizeRequest(
          server,
          ctx,
          p.payload,
          route,
          () => {
            if (!thisIsFn) {
              files.push({ p, resolve })
            } else {
              resolve(thisIsFn(p, ctx))
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
              file.resolve(thisIsFn(file.p, ctx))
            }
          }
        } else {
          sendError(server, ctx, BasedErrorCode.FunctionNotFound, route)
        }
      })
      .catch(() => {
        sendError(server, ctx, BasedErrorCode.FunctionNotFound, route)
      })

    return
  }

  const stream = createDataStream(server, route, ctx, size)

  // destroy stream from context
  authorizeRequest(
    server,
    ctx,
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

            fn(streamPayload, ctx)
              .catch((err) => {
                stream.destroy()
                sendError(server, ctx, BasedErrorCode.FunctionError, {
                  err,
                  route,
                })
              })
              .then((r) => {
                if (
                  stream.readableEnded ||
                  stream.listenerCount('data') === 0
                ) {
                  sendHttpResponse(ctx, r)
                } else {
                  stream.on('end', () => {
                    sendHttpResponse(ctx, r)
                  })
                }
              })
          } else {
            sendError(server, ctx, BasedErrorCode.FunctionNotFound, route)
          }
        })
        .catch((err) => {
          console.error(err)
          sendError(server, ctx, BasedErrorCode.FunctionNotFound, route)
        })
    },
    () => {
      stream.destroy()
    }
  )
}