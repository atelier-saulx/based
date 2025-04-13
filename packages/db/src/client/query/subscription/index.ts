import { BasedDbQuery } from '../BasedDbQuery.js'
import { includeField } from '../query.js'
import { registerQuery } from '../registerQuery.js'
import { OnData, OnError, OnClose } from './types.js'

export const subscribe = (
  q: BasedDbQuery,
  onData: OnData,
  onError?: OnError,
): OnClose => {
  if (!q.def.include.stringFields.size && !q.def.references.size) {
    includeField(q.def, '*')
  }
  registerQuery(q)
  return q.db.hooks.subscribe(q, onData, onError)
}

export * from './types.js'
