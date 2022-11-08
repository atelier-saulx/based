import { BasedClient } from '.'
import { addToQueue } from './queue'
import {
  AuthData,
  AuthRequestTypes,
  GenericObject,
  LoginOpts,
  RegisterOpts,
  RenewTokenOpts,
  RequestTypes,
} from '@based/types'
import createError from './createError'
import { addRequest } from './request'

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
        if (response.id && response.token) {
          client.updateUserState(
            response.id,
            response.token,
            response.refreshToken
          )
        } else {
          client.updateUserState(false)
        }
        resolve(response)
      },
      reject,
    }
  })
}

export const register = (
  client: BasedClient,
  opts: RegisterOpts
): Promise<{ token: string }> =>
  new Promise((resolve, reject) => {
    addRequest(
      client,
      RequestTypes.Call,
      opts,
      (response) => {
        if (response.id && response.token) {
          client.updateUserState(
            response.id,
            response.token,
            response.refreshToken
          )
        } else {
          client.updateUserState(false)
        }
        resolve(response)
      },
      reject,
      'registerUser'
    )
  })

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
      resolve,
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
        client.updateUserState(false)
        resolve(response)
      },
      reject,
    }
  })
}
