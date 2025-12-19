import { BasedDbQuery } from '../BasedDbQuery.js'
import { BasedQueryResponse } from '../BasedQueryResponse.js'
import { registerQuery } from '../registerQuery.js'
import { registerSubscription } from './toByteCode.js'
import { OnData, OnError, OnClose } from './types.js'

export class SubStore {
  listeners: Map<OnData, OnError>
  onClose: OnClose
  response?: BasedQueryResponse
  checksum?: number
  len?: number
  subscribe(q: BasedDbQuery) {
    const onData = (res: Uint8Array) => {
      if (!this.response) {
        this.response = new BasedQueryResponse(q.def!, res, 0)
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
    this.onClose = () => {
      killed = true
    }
    const doSub = () => {
      try {
        registerQuery(q)
        registerSubscription(q)
        q.db.hooks.subscribe(q, onData, onError).then((onClose) => {
          if (killed) {
            onClose()
          } else {
            this.onClose = onClose
          }
        })
      } catch (err) {
        onError(err)
      }
    }
    if (!q.db.schema) {
      q.db
        .schemaIsSet()
        .then(() => {
          if (!killed) {
            doSub()
          }
        })
        .catch((err) => {
          onError(err)
        })
    } else {
      doSub()
    }
  }
  resubscribe(q: BasedDbQuery) {
    this.onClose()
    q.reset()
    this.response = undefined
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
    const store = q.db.subs.get(q)!
    store.listeners.set(onData, onError)
  }
  return () => {
    const store = q.db.subs.get(q)
    if (store) {
      store.listeners.delete(onData)
      if (!store.listeners.size) {
        q.db.subs.delete(q)
        store.onClose()
      }
    }
  }
}

export * from './types.js'
