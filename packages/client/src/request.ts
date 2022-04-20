import { BasedClient } from '.'
import { addToQueue } from './queue'
import { AuthRequestTypes, RequestData, RequestTypes } from '@based/types'
import createError from './createError'
import sendToken from './token'
import { renewToken } from './auth'

let requestIdCnt = 0

export const addRequest = (
  client: BasedClient,
  type:
    | RequestTypes.Set
    | RequestTypes.Get
    | RequestTypes.Configuration
    | RequestTypes.GetConfiguration
    | RequestTypes.Delete
    | RequestTypes.Copy
    | RequestTypes.Digest
    | RequestTypes.Call
    | RequestTypes.RemoveType
    | RequestTypes.RemoveField,
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
    // TODO: check this with Jim
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
      if (
        err.type === 'AuthorizationError' &&
        err.message === 'token expired' &&
        !cb.isRetry
      ) {
        const refreshToken = client.sendTokenOptions.refreshToken
        renewToken(client, {
          refreshToken,
        })
          .then((r: any) => {
            addRequest(
              client,
              cb.type,
              cb.payload,
              cb.resolve,
              cb.reject,
              cb.name,
              true
            )
          })
          .catch((err) => {
            console.error('renweToken error', err)
          })
      } else {
        cb.reject(createError(err))
      }
    } else {
      cb.resolve(payload)
    }
  }
}
