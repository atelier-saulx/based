import { BasedServer } from '../server'
// import { BasedErrorCode, createError } from '../error'
import { ChannelMessageFunction } from '@based/functions'
import { verifyRoute } from '../verifyRoute'
import {
  unsubscribeFunction,
  subscribeChannelFunction,
  hasChannel,
  createChannel,
} from '../channel'
import { installFn } from '../installFn'

export const subscribeChannel = (
  server: BasedServer,
  name: string,
  id: number,
  payload: any,
  update: ChannelMessageFunction
): (() => void) => {
  const route = verifyRoute(
    server,
    server.client.ctx,
    'channel',
    server.functions.route(name),
    name,
    id
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

  installFn(server, server.client.ctx, route).then((spec) => {
    if (isClosed) {
      return
    }
    if (spec === null) {
      // createError(server, ctx, BasedErrorCode.FunctionNotFound, {
      //   route,
      // })
      return
    }
    if (!hasChannel(server, id)) {
      createChannel(server, name, id, payload)
    }
    subscribeChannelFunction(server, id, update)
  })

  return close
}
