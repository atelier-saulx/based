import { Subscription } from './types.js'
import { BasedDb } from '../../../index.js'
import { BasedQueryResponse } from '../BasedIterable.js'
import { DbClient } from '../../index.js'

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
    q.db.hooks
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

export const resetModifySubs = (db: DbClient) => {
  db.modifySubscriptions.forEach((t) => {})
}

export const startSubscription = (db: DbClient) => {
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
