import { ObservableUpdateFunction } from '@based/functions'
import { BasedServer } from '../../server.js'
import { ActiveObservable } from '../types.js'
import { errorListener } from './error.js'

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
