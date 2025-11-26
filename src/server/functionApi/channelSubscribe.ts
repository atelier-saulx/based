import { BasedServer } from '../server.js'
import { verifyRoute } from '../verifyRoute.js'
import {
  unsubscribeFunction,
  subscribeChannelFunction,
  hasChannel,
  createChannel,
} from '../channel/index.js'
import { installFn } from '../installFn.js'
import { createError } from '../error/index.js'
import type { ChannelMessageFunctionInternal } from '../../functions/index.js'
import { BasedErrorCode } from '../../errors/index.js'

export const subscribeChannel = (
  server: BasedServer,
  name: string,
  id: number,
  payload: any,
  update: ChannelMessageFunctionInternal,
): (() => void) => {
  const route = verifyRoute(
    server,
    server.client.ctx,
    'channel',
    server.functions.route(name),
    name,
    id,
  )

  if (route === null) {
    throw new Error(`[${name}] No session in ctx`)
  }

  let isClosed = false

  const close = () => {
    if (isClosed) {
      return
    }
    isClosed = true
    unsubscribeFunction(server, id, update)
  }

  if (hasChannel(server, id)) {
    subscribeChannelFunction(server, id, update)
    return close
  }

  installFn({ server, ctx: server.client.ctx, route }).then((spec) => {
    if (isClosed) {
      return
    }
    if (spec === null) {
      update(
        null,
        createError(
          server,
          server.client.ctx,
          BasedErrorCode.FunctionNotFound,
          {
            route,
          },
        ),
      )
      return
    }
    if (!hasChannel(server, id)) {
      createChannel(server, name, id, payload, true)
    }
    subscribeChannelFunction(server, id, update)
  })

  return close
}
