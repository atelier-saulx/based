import { Authorize, ClientContext, FunctionType } from '../types'
import { getFunctionByName } from './functions'
import { Incoming, IncomingType, OutgoingType } from './types'
import send from './send'
import { BasedErrorCode } from '../error'

export const authorize: Authorize = async (
  client: ClientContext,
  name: string,
  payload?: any
) => {
  const auth = getFunctionByName('authorize', FunctionType.authorize)
  if (auth) {
    return auth(client, name, payload)
  }
  console.error('Cannot find authorize on worker...')
  return false
}

export const incomingAuthorize = (msg: Incoming[IncomingType.Authorize]) => {
  authorize(msg.context, msg.name, msg.payload)
    .then((ok) => {
      send({
        type: OutgoingType.Listener,
        id: msg.id,
        payload: ok,
      })
    })
    .catch((err) => {
      send({
        id: msg.id,
        type: OutgoingType.Listener,
        code: BasedErrorCode.AuthorizeFunctionError,
        err,
      })
    })
}
