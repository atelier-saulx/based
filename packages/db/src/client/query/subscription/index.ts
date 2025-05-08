import { BasedDbQuery } from '../BasedDbQuery.js'
import { BasedQueryResponse } from '../BasedIterable.js'
import { includeField } from '../query.js'
import { registerQuery } from '../registerQuery.js'
import { OnData, OnError, OnClose } from './types.js'

export class SubStore {
  listeners: Map<OnData, OnError>
  onClose: OnClose
  response?: BasedQueryResponse
  checksum?: number
  len?: number
  subscribe(q: BasedDbQuery) {
    if (!q.def.include.stringFields.size && !q.def.references.size) {
      includeField(q.def, '*')
    }

    registerQuery(q)

    this.onClose = q.db.hooks.subscribe(
      q,
      (res: Uint8Array) => {
        if (!this.response) {
          this.response = new BasedQueryResponse(q.id, q.def, res, 0)
        } else {
          this.response.result = res
          this.response.end = res.byteLength
        }
        const checksum = this.response.checksum
        const len = res.byteLength
        if (this.len !== len || this.checksum !== checksum) {
          for (const [onData] of this.listeners) {
            onData(this.response)
          }
          this.len = len
          this.checksum = checksum
        }
      },
      (err: Error) => {
        for (const [, onError] of this.listeners) {
          onError(err)
        }
      },
    )
  }
  resubscribe(q: BasedDbQuery) {
    this.onClose()
    q.reBuildQuery()
    this.response = null
    this.subscribe(q)
  }
}

export const subscribe = (
  q: BasedDbQuery,
  onData: OnData,
  onError?: OnError,
): OnClose => {
  if (!q.db.subs.has(q)) {
    const store = new SubStore()
    store.listeners = new Map([[onData, onError]])
    store.subscribe(q)
    q.db.subs.set(q, store)
  } else {
    const store = q.db.subs.get(q)
    store.listeners.set(onData, onError)
  }

  return () => {
    const store = q.db.subs.get(q)
    store.listeners.delete(onData)
    if (!store.listeners.size) {
      q.db.subs.delete(q)
      store.onClose()
    }
  }
}

export * from './types.js'
