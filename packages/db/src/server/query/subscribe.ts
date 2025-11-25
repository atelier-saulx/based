import { BasedServer } from '../server.js'
import { ActiveObservable } from './types.js'
import { extendCache } from './extendCache.js'
import { sendObsWs } from './send.js'
import { getObsAndStopRemove } from './get.js'
import { sendErrorData } from '../sendError.js'
import type {
  Context,
  ObservableUpdateFunction,
  WebSocketSession,
} from '../../functions/index.js'
import type { BasedErrorCode, BasedErrorData } from '../../errors/index.js'

// make this a FunctionHandler
export const subscribeWs = (
  server: BasedServer,
  id: number,
  checksum: number,
  ctx: Context<WebSocketSession>,
) => {
  const session = ctx.session

  if (!session) {
    return
  }

  const obs = getObsAndStopRemove(server, id)
  session.obs.add(id)

  if (obs.attachedCtx) {
    if (!session.attachedCtxObs) {
      session.attachedCtxObs = new Set()
    }
    session.attachedCtxObs.add(id)
    id = obs.attachedCtx.fromId
  }
  if (session.v! < 2) {
    if (!obs.oldClients) {
      obs.oldClients = new Set()
    }
    obs.oldClients.add(session.id)
    session.ws!.subscribe(String(id) + '-v1')
  } else {
    obs.clients.add(session.id)
    session.ws!.subscribe(String(id))
  }

  if (server.queryEvents) {
    server.queryEvents.subscribe(obs, ctx)
  }

  if (obs.error) {
    sendErrorData(ctx, obs.error)
  }

  if (obs.cache && obs.checksum !== checksum) {
    if (obs.diffCache && obs.previousChecksum === checksum) {
      sendObsWs(ctx, obs.diffCache, obs, true)
    } else {
      sendObsWs(ctx, obs.cache, obs, false)
    }
  }
}

export const subscribeFunction = (
  server: BasedServer,
  id: number,
  update: ObservableUpdateFunction,
) => {
  const obs = getObsAndStopRemove(server, id)

  if (obs.functionObserveClients.add(update)) {
    if (server.queryEvents) {
      server.queryEvents.subscribe(obs)
    }

    if (obs.cache) {
      update(
        obs.rawData,
        obs.checksum,
        null,
        obs.cache,
        obs.diffCache,
        obs.previousChecksum,
        obs.isDeflate,
      )
    }
  }
}

export const subscribeNext = (
  obs: ActiveObservable,
  onNext: (err?: BasedErrorData<BasedErrorCode.FunctionError>) => void,
) => {
  extendCache(obs)
  if (!obs.onNextData) {
    obs.onNextData = new Set()
  }
  obs.onNextData.add(onNext)
}
