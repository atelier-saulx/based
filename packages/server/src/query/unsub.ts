import { BasedServer } from '../server.js'
import { WebSocketSession, Context } from '@based/functions'
import { destroyObs } from './destroy.js'
import { ObservableUpdateFunction } from './types.js'

export const unsubscribeFunction = (
  server: BasedServer,
  id: number,
  update: ObservableUpdateFunction,
): true | void => {
  const obs = server.activeObservablesById.get(id)
  if (!obs) {
    return
  }
  if (obs.functionObserveClients.delete(update)) {
    if (server.queryEvents) {
      server.queryEvents.unsubscribe(obs)
    }
    destroyObs(server, id)
    return true
  }
}

// true means obs does not exist
export const unsubscribeWs = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>,
): true | void => {
  const session = ctx.session

  if (!session) {
    return
  }

  if (!session.obs.has(id)) {
    if (session.attachedCtxObs) {
      let match = false
      for (const attachedId of session.attachedCtxObs) {
        const attachedObs = server.activeObservablesById.get(attachedId)
        if (attachedObs.attachedCtx.fromId === id) {
          session.attachedCtxObs.delete(attachedId)
          if (session.attachedCtxObs.size === 0) {
            delete session.attachedCtxObs
          }
          id = attachedId
          match = true
          break
        }
      }
      if (!match) {
        return
      }
    } else {
      return
    }
  } else if (session.attachedCtxObs?.has(id)) {
    session.attachedCtxObs.delete(id)
    if (session.attachedCtxObs.size === 0) {
      delete session.attachedCtxObs
    }
  }

  const isV1 = ctx.session.v < 2

  const obs = server.activeObservablesById.get(id)
  session.obs.delete(id)

  if (isV1) {
    ctx.session.ws.unsubscribe(String(id) + '-v1')
  } else {
    ctx.session.ws.unsubscribe(String(id))
  }

  if (!obs) {
    return
  }

  if (isV1) {
    if (obs.oldClients.delete(session.id)) {
      if (server.queryEvents) {
        server.queryEvents.unsubscribe(obs, ctx)
      }
      destroyObs(server, id)
      return true
    }
  } else {
    if (obs.clients.delete(session.id)) {
      if (server.queryEvents) {
        server.queryEvents.unsubscribe(obs, ctx)
      }
      destroyObs(server, id)
      return true
    }
  }
}

// true is it does not exist
export const unsubscribeWsIgnoreClient = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>,
): true | void => {
  const session = ctx.session
  if (!session) {
    return
  }
  const obs = server.activeObservablesById.get(id)
  if (!obs) {
    // is not an obs might be a channel
    return true
  }

  if (session.v < 2) {
    if (obs.oldClients?.delete(session.id) && server.queryEvents) {
      server.queryEvents.unsubscribe(obs, ctx)
    }
  } else {
    if (obs.clients.delete(session.id) && server.queryEvents) {
      server.queryEvents.unsubscribe(obs, ctx)
    }
  }

  destroyObs(server, id)
}
