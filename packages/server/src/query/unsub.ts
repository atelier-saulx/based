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

  console.log('yes unsub', session.obs, id)

  console.log(' activeobs', server.activeObservablesById.keys())

  if (!session || !session.obs.has(id)) {
    return
  }

  const isV1 = ctx.session.v < 2

  const obs = server.activeObservablesById.get(id)

  if (!obs) {
    console.log(' Attached', session.attachedCtxObs)
    for (const attachedId of session.attachedCtxObs) {
      const attachedObs = server.activeObservablesById.get(attachedId)
      if (attachedObs.attachedCtx.fromId === id) {
        console.log(' ITS ATTACHED', id, attachedId)
        server.activeObservablesById.delete(attachedId)
        session.obs.delete(id) // stored twice so need to remove this as well (tmp)
        id = attachedId
        break
      }
    }
    // hello
  }

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
