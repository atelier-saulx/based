import { convertToTimestamp, writeUint32, ENCODER, equals } from '@saulx/utils'
import { SnapShotWriteResult, AnalyticsDbCtx } from './types.js'

export const roundToSnapShotInterval = (
  ctx: AnalyticsDbCtx,
  nr: number | string,
) => {
  if (typeof nr === 'string') {
    return (
      Math.floor(convertToTimestamp(nr) / ctx.config.snapShotInterval) *
      ctx.config.snapShotInterval
    )
  }
  return (
    Math.floor(nr / ctx.config.snapShotInterval) * ctx.config.snapShotInterval
  )
}

// constants
export const startSnapShots = (ctx: AnalyticsDbCtx) => {
  const { db } = ctx

  let snapShotTimer: ReturnType<typeof setTimeout>

  const makeSnapshots = async () => {
    if (db.server.stopped) {
      return
    }
    await db.drain()
    const currents = await db.query('current').range(0, 1e6).get()
    const results: SnapShotWriteResult = {}
    for (const current of currents) {
      // { id: 999, geo: 'AE', event: 60, count: 31, active: 45, uniq: 31 }
      let event = results[current.event]
      if (!event) {
        event = results[current.event] = {
          size: 0,
          geo: {},
        }
      }
      event.geo[current.geo] = {
        active: ctx.currents[current.event].geos[current.geo].active,
        uniq: current.uniq,
        count: current.count,
      }
      // 3 numbers + 2 (geo code)
      event.size += 12 + 2
    }
    const now = roundToSnapShotInterval(ctx, Date.now())
    for (const eventId in results) {
      const resultEvent = results[eventId]
      const data = new Uint8Array(resultEvent.size)
      let i = 0
      for (const geo in resultEvent.geo) {
        const d = resultEvent.geo[geo]
        ENCODER.encodeInto(geo, data.subarray(i, i + 2))
        i += 2
        writeUint32(data, d.active, i)
        writeUint32(data, d.uniq, i + 4)
        writeUint32(data, d.count, i + 8)
        i += 12
      }
      const currentEvent = ctx.currents[eventId]
      const lastSnapshotId = currentEvent.lastSnapshotId
      if (lastSnapshotId) {
        const { data: prevData } = await db
          .query('snapshot', lastSnapshotId)
          .include('data')
          .get()
          .toObject()
        if (equals(data, prevData)) {
          continue
        }
      }

      const eventIdNR = Number(eventId)
      const id = db.create('snapshot', {
        ts: now,
        event: eventIdNR,
        data,
      }).tmpId
      db.update('event', eventIdNR, { lastSnapshotId: id, lastSnapshot: now })
      currentEvent.lastSnapshotId = id
      currentEvent.lastSnapshot = now
    }
    if (!db.server.stopped) {
      snapShotTimer = setTimeout(makeSnapshots, ctx.config.snapShotInterval)
    }
  }
  snapShotTimer = setTimeout(makeSnapshots, ctx.config.snapShotInterval)
  return () => {
    console.log('Stop snapthotty')
    clearTimeout(snapShotTimer)
  }
}
