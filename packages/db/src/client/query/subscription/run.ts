import { Subscription } from './types.js'
import { BasedQueryResponse } from '../BasedIterable.js'
import { DbClient } from '../../index.js'
import { resetSubscriptionMarkers } from './markers.js'

export const resultsAreEqual = (a: Uint8Array, b: Uint8Array): boolean => {
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

const EMPTY = new Uint8Array(Buffer.alloc(4))

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
        let err: Error = null
        let buf: Uint8Array
        if (res instanceof Error) {
          err = res
          buf = EMPTY
        } else {
          buf = res
        }
        if (subscription.res) {
          if (resultsAreEqual(subscription.res.result, buf)) {
            return
          }
          subscription.res.execTime = performance.now() - d
          subscription.res.result = buf
          subscription.res.end = buf.byteLength
        } else {
          subscription.res = new BasedQueryResponse(
            q.id,
            q.def,
            buf,
            performance.now() - d,
          )
        }
        subscription.subs.forEach((fn) => {
          fn(subscription.res, err)
        })
      })
      .catch((err) => {
        subscription.inProgress = false
        console.error('Subscription getQuery errors', err)
      })
  }
}

export const startSubscription = (db: DbClient) => {
  console.log('start subscription')
  if (!db.subscriptionsInProgress) {
    db.subscriptionsInProgress = true
    setTimeout(() => {
      console.log('run it')
      db.subscriptionsToRun.forEach((s) => {
        runSubscription(s)
      })
      db.subscriptionsToRun = []
      resetSubscriptionMarkers(db)
      db.subscriptionsInProgress = false
    }, db.subscriptonThrottleMs)
  }
}
