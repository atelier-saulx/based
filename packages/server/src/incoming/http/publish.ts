import { HttpSession, SendHttpResponse, BasedRoute } from '@based/functions'
import { sendHttpResponse } from '../../sendHttpResponse.js'
import { BasedErrorCode } from '@based/errors'
import { sendError } from '../../sendError.js'
import { installFn } from '../../installFn.js'
import { genObserveId } from '@based/protocol/client-server'
import {
  hasChannel,
  createChannel,
  destroyChannel,
  extendChannel,
} from '../../channel/index.js'
import { FunctionHandler } from '../../types.js'

export const httpPublish: FunctionHandler<
  HttpSession,
  BasedRoute<'channel'>
> = async ({ route, server, ctx, payload }) => {
  // Parse channel payload / msg
  let msg: any
  let channelPayload: any
  if (typeof payload !== 'object') {
    msg = payload
  } else {
    if (payload.msg !== undefined) {
      msg = payload.msg
      if (payload.channelid === undefined) {
        channelPayload = {}
        for (const key in payload) {
          if (key === 'msg') continue
          channelPayload[key] = payload[key]
        }
      } else {
        channelPayload = payload.channelid
      }
    } else if (payload.channelid !== undefined) {
      msg = {}
      for (const key in payload) {
        if (key === 'channelid') continue
        msg[key] = payload[key]
      }
      channelPayload = payload.channelid
    } else {
      msg = payload
    }
  }

  const name = route.name
  const id = genObserveId(name, channelPayload)

  installFn({ server, ctx, route }).then(async (spec) => {
    if (spec === null) {
      return
    }

    if (!hasChannel(server, id)) {
      createChannel(server, name, id, channelPayload, true)
      destroyChannel(server, id)
    } else {
      extendChannel(server, server.activeChannelsById.get(id))
    }

    try {
      spec.publisher(server.client, channelPayload, msg, id, ctx)
      if (spec.httpResponse) {
        const send: SendHttpResponse = (responseData, headers, status) => {
          sendHttpResponse(
            ctx,
            responseData,
            headers,
            status !== undefined
              ? typeof status === 'string'
                ? status
                : String(status)
              : undefined,
          )
        }
        await spec.httpResponse(server.client, payload, undefined, send, ctx)
        return
      }
      sendHttpResponse(ctx, undefined)
    } catch (err) {
      sendError(server, ctx, BasedErrorCode.FunctionError, {
        err,
        route,
      })
    }
  })
}
