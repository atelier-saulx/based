import { BasedDb } from '../../../index.js'
import { PropDef, PropDefEdge } from '../../../server/schema/types.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { BasedQueryResponse } from '../BasedIterable.js'
import { includeFields } from '../query.js'
import { registerQuery } from '../registerQuery.js'

export type OnData = (res: BasedQueryResponse) => any

export type OnError = (err: Error) => any

export type OnClose = () => BasedDbQuery

export type OnSubscription = (res: any, err?: Error) => void

export type Subscription = {
  query: BasedDbQuery
  subs: Set<OnSubscription>
  res?: BasedQueryResponse
  closed: boolean
  inProgress: boolean // dont need to check
  // filter - realy nice to add
}

export type SubscriptionsMap = Map<number, Subscription>

export type SubscriptionsToRun = Subscription[]

export type SubscriptionMarkers = any

// for fields its very different
// if shceduled need to remove from every field (-1 on each other field)

// later replace this with native + buffer / externalID

// main fields buffer

// counts have to be send upstream in modify buffer

// TODO for later
// handled x/y/z
// type + id

// Buffer[prop]: subs
// Buffer[start]: subs

// OPTION
// IDS
// very simple
// main: { start: subs }, props: { propNr: subs }, all: subs

// FILTER
// very simple
// main: { start: subs }, props: { propNr: subs }, all: subs

export type ModifySubscriptionMap = Map<
  number, // typeID
  {}
>

export const resultsAreEqual = (a: Buffer, b: Buffer): boolean => {
  const aLen = a.byteLength
  const bLen = b.byteLength
  if (aLen != bLen) {
    return false
  }
  if (a[aLen - 4] != b[bLen - 4]) return false
  if (a[aLen - 3] != b[bLen - 3]) return false
  if (a[aLen - 2] != b[bLen - 2]) return false
  if (a[aLen - 1] != b[bLen - 1]) return false
  return true
}

export const runSubscription = (subscription: Subscription) => {
  if (!subscription.inProgress) {
    subscription.inProgress = true
    const q = subscription.query
    const buf = q.buffer
    const d = performance.now()
    q.db.server
      .getQueryBuf(buf)
      .then((res) => {
        if (subscription.closed) {
          return
        }
        subscription.inProgress = false
        const buf = Buffer.from(res)
        if (subscription.res) {
          if (resultsAreEqual(subscription.res.result, buf)) {
            return
          }
          subscription.res.execTime = performance.now() - d
          subscription.res.result = buf
        } else {
          subscription.res = new BasedQueryResponse(
            q.id,
            q.def,
            buf,
            performance.now() - d,
          )
        }
        subscription.subs.forEach((fn) => {
          fn(subscription.res)
        })
      })
      .catch((err) => {
        subscription.inProgress = false
        console.error('Subscription getQuery errors', err)
      })
  }
}

const resetModifySubs = (db: BasedDb) => {
  db.modifySubscriptions.forEach((t) => {})
}

const startSubscription = (db: BasedDb) => {
  if (!db.subscriptionsInProgress) {
    db.subscriptionsInProgress = true
    setTimeout(() => {
      db.subscriptionsToRun.forEach((s) => {
        runSubscription(s)
      })
      db.subscriptionsToRun = []
      resetModifySubs(db)
      db.subscriptionsInProgress = false
    }, db.subscriptonThrottleMs)
  }
}

// --------------------------------------------
// TODO hooks for update / create

export const getSubscriptionMarkers: SubscriptionMarkers = (
  db: BasedDb,
  typeId: number,
  id: number,
  isCreate: boolean,
) => {
  const t = db.modifySubscriptions.get(typeId)
}

export const checkSubscriptionMarkers = (
  db: BasedDb,
  markers: SubscriptionMarkers,
  prop: PropDef | PropDefEdge, // number
) => {
  console.log(prop, markers)
  // will check filters
}

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
