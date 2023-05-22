import { ObservableUpdateFunction } from '@based/functions'
import { BasedServer } from '../../server'
import { ActiveObservable } from '../types'
import { errorListener } from './error'

// this has to be super optmized!
export const relay = (
  server: BasedServer,
  relay: { target?: string; client: string },
  obs: ActiveObservable,
  client: any,
  update: ObservableUpdateFunction
) => {
  obs.closeFunction = client
    .query(relay.target ?? obs.name, obs.payload)
    .subscribe(update, (err) => {
      errorListener(server, obs, err)
    })
}
