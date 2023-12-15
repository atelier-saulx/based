import { BasedDbClient, protocol, dataRecord } from '@based/db-client'

export const subscribers = new Map<BasedDbClient, Subscriber>()

export class Subscriber {
  constructor(client: BasedDbClient) {
    this.client = client
    this.init = this.initSubs()
    this.initSchema = new Promise<void>((resolve) => {
      this.unsubSchema = this.subscribe(
        {
          schema: true,
        },
        ({ schema }) => {
          if (schema) {
            this.client.schema = schema
          }
          resolve()
        },
        true
      )
    })

    subscribers.set(client, this)
  }

  client: BasedDbClient
  init: Promise<void>
  initSchema: Promise<void>
  unsubSchema: () => void
  subs: Record<number, { update: Function; payload: any }> = {}
  timeBased: { markerId: number; subId: number; nextRefresh: number }[] = []
  timeSubTimer: NodeJS.Timeout
  updateTimer: NodeJS.Timeout
  queuedUpdates: [number, number[]][] = []
  batchInProgress: boolean = false
  queuedMap: Map<number, Set<number>> = new Map()
  subCount = 0
  isDestroyed = false

  trackNowSubs() {
    const now = Date.now()
    const updates: Record<number, Set<number>> = {}
    let nextRefresh: number

    while (this.timeBased[0]?.nextRefresh <= now) {
      const next = this.timeBased.shift()
      if (!next) break
      nextRefresh = next.nextRefresh ?? now + 100
      const { markerId, subId } = next
      if (updates[markerId]) {
        updates[markerId].add(subId)
      } else {
        updates[markerId] = new Set([subId])
      }
    }

    for (const [markerId, subIds] of Object.entries(updates)) {
      this.updateSubs(Number(markerId), Array.from(subIds))
    }

    this.timeSubTimer = setTimeout(() => {
      this.trackNowSubs()
    }, Math.min(1e3 * 60 * 1, Math.max(nextRefresh - now, 100)))
  }

  refresh(res) {
    return res.nextRefresh().then((refreshRes) => {
      if (refreshRes.length) {
        const arr = this.timeBased
        for (const entry of refreshRes) {
          let ok
          for (let i = 0; i < arr.length; i++) {
            if (arr[i].nextRefresh >= entry.nextRefresh) {
              arr.splice(i, 0, entry)
              ok = true
              break
            }
          }
          if (!ok) {
            arr.push(entry)
          }
        }
      }
    })
  }

  async updateBatch() {
    this.batchInProgress = true

    const updates = Array.from(this.queuedMap)
    const promises = []

    this.queuedMap = new Map()

    for (const [markerId, subIds] of updates) {
      subIds.forEach((subId) => {
        const sub = this.subs[subId]
        if (!sub) {
          return
        }

        promises.push(
          this.client.sub(sub.payload, {
            subId,
            markerId,
          })
        )
      })
    }

    const ops = await Promise.all(promises)
    await Promise.all(ops.map(({ cleanup }) => cleanup()))

    try {
      await Promise.all(
        updates.map(([markerId]) => {
          return this.client.refreshMarker(markerId)
        })
      )
    } catch (e) {
      console.error('error refreshing', e)
    }

    await Promise.all(
      ops.map(async (res) => {
        const { fetch, subId } = res
        if (!(subId in this.subs)) return
        await fetch()
        this.refresh(res)
      })
    )

    const subIds = new Set()
    await Promise.all(
      ops.map(async (res) => {
        const { getValue, subId } = res
        if (!(subId in this.subs)) {
          return
        }
        if (subIds.has(subId)) {
          return
        }
        subIds.add(subId)
        const value = await getValue()
        this.subs[subId].update(value)
      })
    )

    if (this.queuedUpdates.length) {
      this.updateBatch()
    } else {
      this.batchInProgress = false
    }
  }

  updateSubs(markerId: number, subIds: number[]) {
    if (this.queuedMap.has(markerId)) {
      const subIdsPerMarker = this.queuedMap.get(markerId)
      subIds.forEach(subIdsPerMarker.add, subIdsPerMarker)
    } else {
      this.queuedMap.set(markerId, new Set(subIds))
    }

    if (!this.updateTimer) {
      this.updateTimer = setTimeout(() => {
        this.updateTimer = null
        if (!this.batchInProgress && !this.isDestroyed) {
          this.updateBatch()
        }
      }, 5)
    }
  }

  pubsub = ([chId, val]) => {
    if (chId === 0) {
      const rec = dataRecord.deserialize(
        protocol.sub_marker_pubsub_message_def,
        val[0]
      )
      // in progress
      // take the last event if rec.marker_id is same
      this.updateSubs(Number(rec.marker_id), rec.sub_ids.map(Number))
      // end
    }
  }

  async initSubs(): Promise<void> {
    this.client.on('pubsub', this.pubsub)
    this.trackNowSubs()
    await this.client.command('subscribe', [0])
  }

  deleteSub(subId) {
    if (subId in this.subs) {
      delete this.subs[subId]
      return this.client.command('subscriptions.del', [subId])
    }
  }

  subscribe(payload, update, skipSchema) {
    let killed
    let subId
    this.subCount++

    this.init.then(async () => {
      if (killed) {
        return
      }

      if (!skipSchema) {
        await this.initSchema

        if (killed) {
          return
        }
      }

      const res = await this.client.sub(payload)
      subId = res.subId

      if (killed) {
        this.deleteSub(subId)
        return
      }

      this.subs[subId] = { update, payload }
      const state = await res.getValue()

      if (killed) {
        this.deleteSub(subId)
        return
      }

      this.refresh(res)
      update(state)
    })

    return () => {
      if (!killed) {
        killed = true
        this.subCount--
        this.deleteSub(subId)
        if (!this.subCount) {
          this.destroy()
        }
      }
    }
  }

  destroy(): void {
    if (!this.isDestroyed) {
      this.isDestroyed = true
      subscribers.delete(this.client)
      clearTimeout(this.timeSubTimer)
      clearTimeout(this.updateTimer)
      this.unsubSchema()
      this.client.off('pubsub', this.pubsub)
    }
  }
}

export const subscribe = async (client: BasedDbClient, payload, update) => {
  let subscriber = subscribers.get(client)
  if (!subscriber) {
    subscriber = new Subscriber(client)
  }
  return subscriber.subscribe(payload, update, false)
}
