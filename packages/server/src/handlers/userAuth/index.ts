import { BasedServer } from '../..'
import Client from '../../Client'
import { AuthMessage, RequestTypes, AuthRequestTypes } from '@based/client'
import { Params } from '../../Params'
import { getFunction } from '../../getFromConfig'

export default async (
  server: BasedServer,
  client: Client,
  [, authRequestType, reqId, payload]: AuthMessage
) => {
  if (authRequestType === AuthRequestTypes.Login) {
    if (typeof payload === 'string')
      throw new Error('payload cannot be a string')
    try {
      const { function: fn } = (await getFunction(server, 'login')) || {}
      if (!fn) {
        throw new Error('login function is not implemented')
      }
      const token = await fn(new Params(server, payload, client, ['login']))
      client.send([RequestTypes.Auth, reqId, token])
    } catch (err) {
      client.send([
        RequestTypes.Auth,
        reqId,
        0,
        {
          type: 'LoginError',
          name: 'login',
          message: err.message,
          payload,
        },
      ])
    }
  } else if (authRequestType === AuthRequestTypes.Logout) {
    try {
      const { function: fn } = (await getFunction(server, 'logout')) || {}
      const result = fn
        ? await fn(new Params(server, payload, client, ['logout']))
        : {}
      client.send([RequestTypes.Auth, reqId, result])
    } catch (err) {
      client.send([
        RequestTypes.Auth,
        reqId,
        0,
        {
          type: 'LogoutError',
          name: 'logout',
          message: err.message,
          payload,
        },
      ])
    }
  } else if (authRequestType === AuthRequestTypes.RenewToken) {
    try {
      const { function: fn } = (await getFunction(server, 'renewToken')) || {}
      if (!fn) {
        throw new Error('Token expired and needs to be renewed.')
      }
      const result = await fn(
        new Params(server, payload, client, ['renewToken'])
      )
      client.send([RequestTypes.Auth, reqId, result])
    } catch (err) {
      client.send([
        RequestTypes.Auth,
        reqId,
        0,
        {
          type: 'RenewTokenError',
          name: 'renewToken',
          message: err.message,
          payload,
        },
      ])
    }
  }
}
