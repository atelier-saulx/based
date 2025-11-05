import { BasedDbQuery } from '../BasedDbQuery.js'
import { BasedQueryResponse } from '../BasedQueryResponse.js'
import { registerQuery } from '../registerQuery.js'
import { OnData, OnError, OnClose } from './types.js'

// exec
// subscription thing

export class SubStore {
  listeners: Map<OnData, OnError>
  onClose: OnClose
  response?: BasedQueryResponse
  checksum?: number
  len?: number
  subscribe(q: BasedDbQuery) {
    const onData = (res: Uint8Array) => {
      if (!this.response) {
        this.response = new BasedQueryResponse(q.def, res, 0)
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
    }

    const onError = (err: Error) => {
      for (const [, onError] of this.listeners) {
        onError(err)
      }
    }
    let killed = false

    if (!q.db.schema) {
      q.db
        .schemaIsSet()
        .then(() => {
          if (!killed) {
            try {
              registerQuery(q)
              this.onClose = q.db.hooks.subscribe(q, onData, onError)
            } catch (err) {
              onError(err)
            }
          }
        })
        .catch((err) => {
          onError(err)
        })
      this.onClose = () => {
        killed = true
      }
    } else {
      try {
        registerQuery(q)

        // ----- fi

        this.onClose = q.db.hooks.subscribe(q, onData, onError)
      } catch (err) {
        onError(err)
        this.onClose = () => {}
      }
    }
  }
  resubscribe(q: BasedDbQuery) {
    this.onClose()
    q.reset()
    this.response = null
    this.subscribe(q)
  }
}

export const subscribe = (
  q: BasedDbQuery,
  onData: OnData,
  onError: OnError,
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
