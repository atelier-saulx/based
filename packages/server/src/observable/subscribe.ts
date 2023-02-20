import { BasedServer } from '../server'
import { ActiveObservable, ObservableUpdateFunction } from './types'
import { extendCache } from './extendCache'
import { BasedErrorCode, BasedErrorData } from '../error'
import { sendObsWs } from './send'
import { getObsAndStopRemove } from './get'
import { sendErrorData } from '../sendError'
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
  if (obs.functionObserveClients.add(update))
    if (obs.cache) {
      update(
        obs.cache,
        obs.checksum,
        obs.diffCache,
        obs.previousChecksum,
        obs.isDeflate
      )
    }
}

export const subscribeNext = (
  obs: ActiveObservable,
  onNext: (err?: BasedErrorData<BasedErrorCode.ObservableFunctionError>) => void
) => {
  extendCache(obs)
  if (!obs.onNextData) {
    obs.onNextData = new Set()
  }
  obs.onNextData.add(onNext)
}
