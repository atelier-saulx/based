import { BasedClient } from '.'
import { addToQueue } from './queue'
import {
  AuthData,
  AuthRequestTypes,
  GenericObject,
  LoginOpts,
  RenewTokenOpts,
  RequestTypes,
} from '@based/types'
import createError from './createError'
import sendToken from './token'

let loginCbId = 0

export const login = (
  client: BasedClient,
  opts: LoginOpts
): Promise<{ token: string }> => {
  const reqId = ++loginCbId
  addToQueue(client, [RequestTypes.Auth, AuthRequestTypes.Login, reqId, opts])
  return new Promise((resolve, reject) => {
    client.authCallbacks[reqId] = {
      resolve: (response) => {
        sendToken(client, response.token, {
          refreshToken: response.refreshToken,
        })
        resolve(response)
      },
      reject,
    }
  })
}

export const renewToken = (
  client: BasedClient,
  opts: RenewTokenOpts
): Promise<{ token: string }> => {
  const reqId = ++loginCbId
  addToQueue(client, [
    RequestTypes.Auth,
    AuthRequestTypes.RenewToken,
    reqId,
    opts,
  ])
  return new Promise((resolve, reject) => {
    client.authCallbacks[reqId] = {
      resolve: (response) => {
        sendToken(client, response.token)
        resolve(response)
      },
      reject,
    }
  })
}

export const incomingAuthRequest = (client: BasedClient, data: AuthData) => {
  const [, reqId, payload, err] = data
  const cb = client.authCallbacks[reqId]
  if (cb) {
    delete client.authCallbacks[reqId]
    if (err) {
      cb.reject(createError(err))
    } else {
      cb.resolve(payload)
    }
  }
}

export const logout = (client: BasedClient): Promise<GenericObject> => {
  const reqId = ++loginCbId
  addToQueue(client, [RequestTypes.Auth, AuthRequestTypes.Logout, reqId])
  return new Promise((resolve, reject) => {
    client.authCallbacks[reqId] = {
      resolve: (response) => {
        sendToken(client)
        resolve(response)
      },
      reject,
    }
  })
}
