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
import sendToken from './token'
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
        client.updateUserState(
          { email: response.email, id: response.id },
          response.token,
          response.refreshToken
        )
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
        client.updateUserState(
          { email: response.email, id: response.id },
          response.token,
          response.refreshToken
        )
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
      resolve: (response) => {
        // call state
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
        client.updateUserState(false, false)
        resolve(response)
      },
      reject,
    }
  })
}
