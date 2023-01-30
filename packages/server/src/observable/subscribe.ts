import { BasedServer } from '../server'
import { ActiveObservable, ObservableUpdateFunction } from './types'
import { extendCache } from './extendCache'
import { BasedErrorCode, BasedErrorData } from '../error'
import { sendObsWs } from './send'
import { getObs } from './get'
import { sendErrorData } from '../sendError'
import { WebSocketSession, Context } from '@based/functions'

export const subscribeWs = (
  server: BasedServer,
  id: number,
  checksum: number,
  ctx: Context<WebSocketSession>
) => {
  if (!ctx.session) {
    return
  }

  ctx.session.subscribe(String(id))
  const obs = getObs(server, id)

  ctx.session.obs.add(id)
  obs.clients.add(ctx.session.id)

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
  // TODO: FIX THIS
  const obs = getObs(server, id)
  if (obs.functionObserveClients.add(update))
    if (obs.cache) {
      // will make this better!
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
