import { BasedDbQuery } from '../BasedDbQuery.js'
import { registerQuery } from '../registerQuery.js'
import { OnData, OnError, OnClose } from './types.js'

export const subscribe = (
  q: BasedDbQuery,
  onData: OnData,
  onError?: OnError,
): OnClose => {
  registerQuery(q)
  return q.db.hooks.subscribe(q, onData, onError)
}

export * from './types.js'
