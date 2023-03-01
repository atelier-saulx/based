import {
  BasedChannelFunctionRoute,
  BasedChannelFunctionSpec,
} from '../../functions'
import { HttpSession, SendHttpResponse } from '@based/functions'
import { sendHttpResponse } from '../../sendHttpResponse'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { installFn } from '../../installFn'
import { IsAuthorizedHandler } from '../../authorize'
import { genObservableId } from '../../observable'
import {
  hasChannel,
  createChannel,
  destroyChannel,
  extendChannel,
} from '../../channel'

export const httpPublish: IsAuthorizedHandler<HttpSession> = async (
  route: BasedChannelFunctionRoute,
  spec: BasedChannelFunctionSpec,
  server,
  ctx,
  payload
) => {
  // parse channel payload / msg
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
  const id = genObservableId(name, channelPayload)

  installFn(server, ctx, route).then(async (spec) => {
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
      spec.publish(server.client, channelPayload, msg, id, ctx)
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
              : undefined
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
