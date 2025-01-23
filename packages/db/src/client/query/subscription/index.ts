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

// for fields its very different
// if shceduled need to remove from every field (-1 on each other field)

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
          props: Map<
            string, // Props
            {
              total: number
              toCheck: number
              subs: Subscription[]
            }
          >
        }
      >
    }
    filters: {
      toCheck: number
      total: number
      subs: Subscription[]
    }
  }
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

const resetToCheckCounters = (db: BasedDb) => {
  db.modifySubscriptions.forEach((s) => {
    s.filters.toCheck = s.filters.total
    s.ids.toCheck = s.ids.total
    s.toCheck = s.total
    s.ids.subs.forEach((s) => {
      s.toCheck = s.total
    })
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

// TODO hooks for update / create

// will add fields here
export const checkFilterSubscription = (db: BasedDb, typeId: number) => {
  const t = db.modifySubscriptions.get(typeId)
  if (t && t.toCheck != 0) {
    if (t.filters.toCheck) {
      t.toCheck -= t.filters.subs.length
      t.filters.toCheck -= t.filters.subs.length
      db.subscriptionsToRun.push(...t.filters.subs)
      startSubscription(db)
    }
  }
}

// subscriptionsInProgress

// check for id before
// will add fields here
export const checkIdSubscription = (
  db: BasedDb,
  typeId: number,
  id: number,
) => {
  const t = db.modifySubscriptions.get(typeId)
  if (t && t.toCheck != 0) {
    if (t.ids.toCheck != 0) {
      const s = t.ids.subs.get(id)
      if (s && s.toCheck != 0) {
        // if (s.all.toCheck != 0) {
        //   s.all.toCheck -= s.all.toCheck
        //   t.ids.toCheck -= s.all.toCheck
        //   t.toCheck -= s.all.toCheck
        //   db.subscriptionsToRun.push(...s.all.subs.values())
        //   startSubscription(db)
        // }
        return s.props
      }
    }
  }
}

export const checkIdSubscriptionProp = (
  db: BasedDb,
  props: any,
  prop: string,
) => {
  console.log(prop, props)
}

export const checkSubFields = (subs: Subscription[], field: number) => {
  // blurf check them subs
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
          subs: [],
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
          props: new Map(),
        })
      }
      const idModifySubscription = modifySubscriptionsType.ids.subs.get(id)

      subscription.query.def.include.stringFields.forEach((key) => {
        if (!idModifySubscription.props.has(key)) {
          idModifySubscription.props.set(key, {
            total: 0,
            toCheck: 0,
            subs: [],
          })
        }
        const propSubs = idModifySubscription.props.get(key)
        propSubs.subs.push(subscription)
        propSubs.toCheck++
        propSubs.total++
        idModifySubscription.total++
        idModifySubscription.toCheck++
        modifySubscriptionsType.ids.total++
        modifySubscriptionsType.ids.toCheck++
        modifySubscriptionsType.total++
        modifySubscriptionsType.toCheck++
      })
    } else if ('alias' in q.def.target) {
      // later
    } else {
      const filters = modifySubscriptionsType.filters
      filters.subs.push(subscription)

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
