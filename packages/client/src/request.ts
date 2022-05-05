import { BasedClient } from '.'
import { addToQueue } from './queue'
import { RequestData, RequestTypes } from '@based/types'
import createError from './createError'

let requestIdCnt = 0

export const addRequest = (
  client: BasedClient,
  type: Exclude<
    RequestTypes,
    | RequestTypes.Subscription
    | RequestTypes.SubscriptionDiff
    | RequestTypes.SendSubscriptionData
    | RequestTypes.Unsubscribe
    | RequestTypes.GetSubscription
    | RequestTypes.Token
    | RequestTypes.Track
  >,
  // TODO: Changed to Exclude so don't have to update
  // these lists every time.
  // Check why the above should not be here. Maybe create it's own type
  // old:
  // | RequestTypes.Set
  // | RequestTypes.Get
  // | RequestTypes.Configuration
  // | RequestTypes.GetConfiguration
  // | RequestTypes.Delete
  // | RequestTypes.Copy
  // | RequestTypes.Digest
  // | RequestTypes.Call
  // | RequestTypes.RemoveType
  // | RequestTypes.RemoveField
  // | RequestTypes.Auth,
  payload: any,
  resolve: (val?: any) => void,
  reject: (err: Error) => void,
  name?: string,
  isRetry?: boolean
) => {
  const id = ++requestIdCnt
  client.requestCallbacks[id] = {
    resolve,
    reject,
    type,
    payload,
    name,
    isRetry,
  }

  if (type === RequestTypes.Call) {
    addToQueue(client, [type, name, id, payload])
  } else {
    addToQueue(client, [type, id, payload])
  }
}

export const abortRequest = () => {
  // if its still in queue remove from queue
}

export const cleanUpRequests = () => {
  // on re-connect and not in queue anymore - need to remove in that case
}

export const incomingRequest = (client: BasedClient, data: RequestData) => {
  const [, reqId, payload, err] = data

  const cb = client.requestCallbacks[reqId]
  if (cb) {
    delete client.requestCallbacks[reqId]
    if (err) {
      cb.reject(createError(err))
    } else {
      cb.resolve(payload)
    }
  }
}
