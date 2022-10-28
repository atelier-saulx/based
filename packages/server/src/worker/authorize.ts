import { threadId } from 'worker_threads'
import { Authorize, ClientContext } from '../types'

export const state: {
  authorize?: Authorize
} = {}

export const authorize: Authorize = async (
  client: ClientContext,
  name: string,
  payload?: any
) => {
  if (!state.authorize) {
    console.warn('No authorize installed in worker...', threadId)
    return true
  }
  // needs callstack...
  return state.authorize(client, name, payload)
}
