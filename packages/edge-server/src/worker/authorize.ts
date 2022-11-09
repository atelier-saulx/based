import { Authorize, ClientContext, FunctionType } from '../types'
import { getFunctionByName } from './functions'

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
