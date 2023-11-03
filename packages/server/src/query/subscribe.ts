import { BasedServer } from '../server.js'
import { ActiveObservable, ObservableUpdateFunction } from './types.js'
import { extendCache } from './extendCache.js'
import { BasedErrorCode, BasedErrorData } from '../error/index.js'
import { sendObsWs } from './send.js'
import { getObsAndStopRemove } from './get.js'
import { sendErrorData } from '../sendError.js'
import { WebSocketSession, Context } from '@based/functions'

export const subscribeWs = (
  server: BasedServer,
  id: number,
  checksum: number,
  ctx: Context<WebSocketSession>
) => {
  const session = ctx.session

  if (!session) {
    return
  }

  ctx.session.ws.subscribe(String(id))
  const obs = getObsAndStopRemove(server, id)

  session.obs.add(id)
  obs.clients.add(session.id)

  if (obs.error) {
    sendErrorData(ctx, obs.error)
    return
  }

  if (server.queryEvents) {
    server.queryEvents.subscribe(obs, ctx)
  }

  if (obs.cache && obs.checksum !== checksum) {
    if (obs.diffCache && obs.previousChecksum === checksum) {
      sendObsWs(ctx, obs.diffCache, obs)
    } else {
      sendObsWs(ctx, obs.cache, obs)
    }
  }
}

export const subscribeFunction = (
  server: BasedServer,
  id: number,
  update: ObservableUpdateFunction
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
        obs.isDeflate
      )
    }
  }
}

export const subscribeNext = (
  obs: ActiveObservable,
  onNext: (err?: BasedErrorData<BasedErrorCode.FunctionError>) => void
) => {
  extendCache(obs)
  if (!obs.onNextData) {
    obs.onNextData = new Set()
  }
  obs.onNextData.add(onNext)
}
