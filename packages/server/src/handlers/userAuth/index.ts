import { BasedServer } from '../..'
import Client from '../../Client'
import { AuthMessage, RequestTypes, AuthRequestTypes } from '@based/client'
import { Params } from '../../Params'

export default async (
  server: BasedServer,
  client: Client,
  [, authRequestType, reqId, payload]: AuthMessage
) => {
  if (authRequestType === AuthRequestTypes.Login) {
    if (typeof payload === 'string')
      throw new Error('payload cannot be a string')
    try {
      const token = await server.config.login(
        new Params(server, payload, client, ['login'])
      )
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
      const result = await server.config.logout(
        new Params(server, payload, client, ['logout'])
      )
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
      const result = await server.config.renewToken(
        new Params(server, payload, client, ['refreshToken'])
      )
      client.send([RequestTypes.Auth, reqId, result])
    } catch (err) {
      client.send([
        RequestTypes.Auth,
        reqId,
        0,
        {
          type: 'RefreshTokenError',
          name: 'refreshToken',
          message: err.message,
          payload,
        },
      ])
    }
  }
}
