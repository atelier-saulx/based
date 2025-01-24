import { BasedDbQuery } from '../BasedDbQuery.js'
import { includeFields } from '../query.js'
import { registerQuery } from '../registerQuery.js'
import {
  Subscription,
  OnSubscription,
  OnData,
  OnError,
  OnClose,
} from './types.js'
import { runSubscription } from './run.js'
import { addSubscriptionMarkers, removeSubscriptionMarkers } from './markers.js'

export * from './types.js'
export * from './markers.js'

export const subscribe = (
  q: BasedDbQuery,
  onData: OnData,
  onError: OnError,
): OnClose => {
  let closed = false

  if (!q.def.include.stringFields.size && !q.def.references.size) {
    includeFields(q.def, ['*'])
  }

  registerQuery(q)

  if (!q.db.subscriptions.has(q.id)) {
    const subscription: Subscription = {
      query: q,
      subs: new Set(),
      inProgress: false,
      closed: false,
    }
    q.db.subscriptions.set(q.id, subscription)
    addSubscriptionMarkers(q)
  }

  const fn: OnSubscription = (res, err) => {
    if (!closed) {
      if (err) {
        onError(err)
      } else {
        onData(res)
      }
    }
  }

  const sub = q.db.subscriptions.get(q.id)

  const close = () => {
    sub.subs.delete(fn)
    if (sub.subs.size === 0) {
      q.db.subscriptions.delete(q.id)
      removeSubscriptionMarkers(q)
    }
    closed = true
    return q
  }

  sub.subs.add(fn)

  if (!sub.inProgress) {
    runSubscription(sub)
  } else if (sub.res) {
    onData(sub.res)
  }

  return close
}
