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

  // TODO can use this in get as well!

  if (!q.db.subscriptions.has(q.id)) {
    const subscription: Subscription = {
      query: q,
      subs: new Set(),
      inProgress: false,
      closed: false,
    }

    q.db.subscriptions.set(q.id, subscription)

    const typeId = q.def.schema.id

    if (!q.db.modifySubscriptions.has(typeId)) {
      // if is id
      q.db.modifySubscriptions.set(typeId, {
        toCheck: 0,
        total: 0,
        ids: {
          toCheck: 0,
          total: 0,
          subs: new Map(),
        },
        filters: {
          toCheck: 0,
          total: 0,
          subs: [],
        },
      })
      //-----------
    }

    const modifySubscriptionsType = q.db.modifySubscriptions.get(typeId)

    if ('id' in q.def.target) {
    } else if ('alias' in q.def.target) {
      // later
    } else {
      // FILTERS
      // add specific stuff
    }
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
      // sub.closed = true
      // q.db.subscriptions.delete(q.id)
      console.error('DELETE SUB!')
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

  // TODO: optional await will wait for the first one!

  return close
}
