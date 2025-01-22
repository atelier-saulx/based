import { BasedDb } from '../../../index.js'
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
  inProgress: boolean // for remote
}

export type SubscriptionsMap = Map<number, Subscription>

export type SubscriptionsToRun = Subscription[]

// later replace this with native + buffer / externalID
export type ModifySubscriptionMap = Map<
  number, // typeID
  {
    toCheck: number
    total: number
    ids: {
      toCheck: number
      total: number
      subs: Map<
        number, // TARGET ID
        {
          toCheck: number
          total: number
          // nice to have fields here
          // Buffer [0,1,2,3,4] // so full buffer and check if
          subs: Map<
            number, // SUB ID
            Subscription
          >
        }
      >
    }
    alias: {
      toCheck: number
      total: number
      subs: Map<
        string, // ALIAS
        {
          toCheck: number
          total: number
          // nice to have fields here
          // Buffer [0,1,2,3,4] // so full buffer and check if
          subs: Map<
            number, // SUB ID
            Subscription
          >
        }
      >
    }
    filters: {
      toCheck: number
      total: number
      // nice to have fields here
      // Buffer [0,1,2,3,4] // so full buffer and check if
      subs: Map<
        number, // SUB ID
        Subscription
      >
    }
  }
>

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
          if (buf.equals(subscription.res.result)) {
            console.log('sub = isEqual')
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

const resetToCheckCounters = (db: BasedDb) => {
  db.modifySubscriptions.forEach((s) => {
    // do this better
    s.filters.toCheck = s.filters.total
  })
}

const startSubscription = (db: BasedDb) => {
  if (!db.subscriptionsInProgress) {
    db.subscriptionsInProgress = true
    setTimeout(() => {
      db.subscriptionsToRun.forEach((s) => {
        runSubscription(s)
      })
      db.subscriptionsToRun = []
      resetToCheckCounters(db)
      db.subscriptionsInProgress = false
      // sub time is configurable
    }, 20)
  }
}

// will add fields here
export const checkFilterSubscription = (db: BasedDb, typeId: number) => {
  const t = db.modifySubscriptions.get(typeId)
  if (t && t.toCheck != 0) {
    t.toCheck--
    db.subscriptionsToRun.push(...t.filters.subs.values())
    startSubscription(db)
  }
}

// subscriptionsInProgress

// will add fields here
export const checkIdSubscription = (typeId: number, id: number) => {
  // step 1
}

export const checkAliasSubscription = () => {}

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
          subs: new Map(),
        },
        alias: {
          toCheck: 0,
          total: 0,
          subs: new Map(),
        },
      })
      //-----------
    }

    const modifySubscriptionsType = q.db.modifySubscriptions.get(typeId)

    if ('id' in q.def.target) {
      const id = q.def.target.id as number
      // derp
      if (!modifySubscriptionsType.ids.subs.has(id)) {
        modifySubscriptionsType.ids.subs.set(id, {
          total: 0,
          toCheck: 0,
          subs: new Map(),
        })
      }
      const idModifySubscription = modifySubscriptionsType.ids.subs.get(id)
      idModifySubscription.subs.set(q.id, subscription)
      idModifySubscription.total++
      idModifySubscription.toCheck++
    } else if ('alias' in q.def.target) {
      // later
    } else {
      const filters = modifySubscriptionsType.filters
      filters.subs.set(q.id, subscription)
      filters.total++
      filters.toCheck++
      modifySubscriptionsType.total++
      modifySubscriptionsType.toCheck++

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
