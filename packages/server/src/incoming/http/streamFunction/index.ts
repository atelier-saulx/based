import createDataStream from './stream'
import { BasedServer } from '../../../server'
import { sendError } from '../../../sendError'
import getExtension from './getExtension'
import {
  BasedFunctionRoute,
  isObservableFunctionSpec,
} from '../../../functions'
import {
  HttpSession,
  Context,
  StreamPayload,
  BasedStreamFunction,
} from '@based/functions'
import { authorizeRequest } from '../authorize'
import { BasedErrorCode, BasedErrorData, createError } from '../../../error'
import multipartStream from './multipartStream'
import { sendHttpResponse } from '../../../sendHttpResponse'
import mimeTypes from 'mime-types'
import { parseQuery } from '@saulx/utils'

export const httpStreamFunction = (
  server: BasedServer,
  ctx: Context<HttpSession>,
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

  let type = ctx.session.headers['content-type']

  if (type && type.startsWith('multipart/form-data')) {
    ctx.session.res.cork(() => {
      ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
      ctx.session.res.writeHeader('Access-Control-Allow-Headers', '*')
      ctx.session.corsSend = true
    })

    const files: {
      resolve: (payload: StreamPayload) => void
      reject: (err: BasedErrorData) => void
      payload: StreamPayload
    }[] = []
    let installedFn: BasedStreamFunction

    multipartStream(ctx, server, route, (payload) => {
      return new Promise((resolve, reject) => {
        authorizeRequest(
          server,
          ctx,
          payload,
          route,
          (payload) => {
            if (!installedFn) {
              files.push({ payload, resolve, reject })
            } else {
              installedFn(server.client, payload, ctx)
                .then(resolve)
                .catch((err) => {
                  payload.stream.destroy()
                  reject(
                    createError(server, ctx, BasedErrorCode.FunctionError, {
                      route,
                      err,
                    })
                  )
                })
            }
          },
          (payload) => {
            console.info('NO AUTH SEND ERROR!')
            payload.stream.destroy()
            reject(
              createError(server, ctx, BasedErrorCode.AuthorizeRejectedError, {
                route,
              })
            )
          }
        )
      })
    })

    server.functions
      .install(route.name)
      .then((spec) => {
        if (spec && !isObservableFunctionSpec(spec) && spec.stream) {
          installedFn = spec.function
          if (files.length) {
            for (const file of files) {
              installedFn(server.client, file.payload, ctx)
                .then(file.resolve)
                // eslint-disable-next-line prefer-promise-reject-errors
                .catch((err) =>
                  file.reject(
                    createError(server, ctx, BasedErrorCode.FunctionError, {
                      route,
                      err,
                    })
                  )
                )
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

  const extension = ctx.session.req.getHeader('content-extension')

  if (extension) {
    const mime = mimeTypes.lookup(extension)
    if (mime) {
      type = ctx.session.headers['content-type'] = mime
    }
  }

  const stream = createDataStream(server, route, ctx, size)
  // const payload = parsePayload(ctx.session.req.getHeader('payload'))

  let payload: any
  if ('query' in ctx.session) {
    try {
      payload = parseQuery(decodeURIComponent(ctx.session.query))
    } catch (err) {}
  }

  const streamPayload: StreamPayload = {
    payload,
    stream,
    size,
    mimeType: type,
    extension: getExtension(type) || '',
  }

  // destroy stream from context
  authorizeRequest(
    server,
    ctx,
    streamPayload,
    route,
    () => {
      server.functions
        .install(route.name)
        .then((spec) => {
          if (spec && !isObservableFunctionSpec(spec) && spec.stream) {
            const fn = spec.function
            fn(server.client, streamPayload, ctx)
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
      sendError(server, ctx, BasedErrorCode.AuthorizeRejectedError, { route })
    }
  )
}
