import {
  HttpSession,
  SendHttpResponse,
  BasedRoute,
  BasedFunctionConfig,
} from '@based/functions'
import { sendHttpResponse } from '../../sendHttpResponse.js'
import { BasedErrorCode } from '@based/errors'
import { sendError } from '../../sendError.js'
import { IsAuthorizedHandler } from '../../authorize.js'

export const httpFunction: IsAuthorizedHandler<HttpSession> = async (
  route: BasedRoute<'http'>,
  spec: BasedFunctionConfig<'http'>,
  server,
  ctx,
  payload
) => {
  const send: SendHttpResponse = (responseData, headers, status) => {
    if (!ctx.session) {
      return
    }
    if (!status) {
      sendHttpResponse(ctx, responseData, headers)
    } else {
      sendHttpResponse(
        ctx,
        responseData,
        headers,
        typeof status === 'string' ? status : String(status)
      )
    }
  }

  if (spec.relay) {
    const client = server.clients[spec.relay.client]

    if (!client) {
      sendError(server, ctx, BasedErrorCode.FunctionError, {
        err: new Error('Cannot find client ' + spec.relay),
        route,
      })
      return
    }

    client
      .call(spec.relay.target ?? spec.name, payload)
      .then(async (result) => {
        if (!ctx.session) {
          return
        }
        if (spec.fn) {
          await spec.fn(server.client, payload, send, ctx)
          return
        }

        sendHttpResponse(ctx, result)
      })
      .catch((err) => {
        sendError(server, ctx, BasedErrorCode.FunctionError, {
          err,
          route,
        })
      })

    return
  }

  spec
    .fn(server.client, payload, send, ctx)
    .then(async (result) => {
      if (!ctx.session) {
        return
      }
      if (spec.fn) {
        await spec.fn(server.client, payload, send, ctx)
        return
      }

      sendHttpResponse(ctx, result)
    })
    .catch((err) => {
      sendError(server, ctx, BasedErrorCode.FunctionError, {
        err,
        route,
      })
    })
}
