import { Authorize, ClientContext, FunctionType } from '../types'
import { getFunctionByName } from './functions'
import { parentPort } from 'node:worker_threads'

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

export const incomingAuthorize = (d: any) => {
  authorize(d.context, d.name, d.payload)
    .then((ok) => {
      parentPort.postMessage({
        id: d.id,
        payload: ok,
      })
    })
    .catch((err) => {
      parentPort.postMessage({
        id: d.id,
        err,
      })
    })
}
