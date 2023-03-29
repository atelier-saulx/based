import { ObservableUpdateFunction } from '@based/functions'
import { BasedServer } from '../../server'
import { ActiveObservable } from '../types'
import { errorListener } from './error'
import type { BasedClient } from '@based/client'

// this has to be super optmized!
export const relay = (
  server: BasedServer,
  obs: ActiveObservable,
  client: BasedClient,
  update: ObservableUpdateFunction
) => {
  /*
  error later..
   (err) => {
      errorListener(server, obs, err)
    }
  */

  obs.closeFunction = client
    .query(obs.name, obs.payload)
    .subscribeBinary((data?: Uint8Array, diff?: Uint8Array) => {
      console.info(data, diff)
    })
}
