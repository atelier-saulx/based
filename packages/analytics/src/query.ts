import { DECODER, readUint32 } from '@saulx/utils'
import { roundToSnapShotInterval } from './snapShots.js'
import { AnalyticsDbCtx, SnapShotResult } from './types.js'

const readGroupData = (result: Uint8Array) => {
  const grouped = {}
  let i = 0
  while (i < result.byteLength) {
    const geo = DECODER.decode(result.subarray(i, i + 2))
    i += 2
    grouped[geo] = {
      active: readUint32(result, i),
      uniq: readUint32(result, i + 4),
      count: readUint32(result, i + 8),
    }
    i += 12
  }
  return grouped
}

export const querySnapshots = async (
  ctx: AnalyticsDbCtx,
  p: {
    start?: number | string
    end?: number | string
    events: string[]
    resolution?: number
    current?: boolean
    range?: { start: number; end: number }
  },
) => {
  // optional
  const snapshotsQuery = ctx.db.query('snapshot').sort('ts', 'desc')

  if (p.range) {
    snapshotsQuery.range(p.range.start || 0, p.range.end || 1e3)
  }

  const individualSnapshotIds: number[] = []
  const currentIds: number[] = []
  const mappedEvents: Set<number> = new Set()
  for (const ev of p.events) {
    const eventId = ctx.eventTypes[ev]
    if (eventId !== undefined) {
      mappedEvents.add(eventId)
    }
  }

  if (p.start) {
    snapshotsQuery.filter('ts', '>=', roundToSnapShotInterval(ctx, p.start))
  } else {
    for (const ev of mappedEvents) {
      const curr = ctx.currents[ev]
      for (const geo in curr.geos) {
        currentIds.push(curr.geos[geo].id)
      }
    }
  }

  if (p.end) {
    // handle mapped events
    const ts = roundToSnapShotInterval(ctx, p.end)
    snapshotsQuery.filter('ts', '<=', ts)
    for (const ev of mappedEvents) {
      const currentEvent = ctx.currents[ev]
      if (currentEvent.lastSnapshot != 0 && currentEvent.lastSnapshot < ts) {
        mappedEvents.delete(ev)
        individualSnapshotIds.push(currentEvent.lastSnapshotId)
      }
    }
  }

  const results: SnapShotResult = {}

  if (currentIds.length) {
    const now = Date.now()
    const currents = await ctx.db
      .query('current', currentIds)
      .include('count', 'uniq', 'geo', 'event')
      .get()
    for (const item of currents) {
      const eventName = ctx.eventTypesInverse[item.event]
      if (!results[eventName]) {
        results[eventName] = [
          {
            id: 0,
            ts: now,
            event: eventName,
            data: {},
          },
        ]
      }
      const grouped = results[eventName][0].data
      grouped[item.geo] = {
        active: ctx.currents[item.event].geos[item.geo].active,
        uniq: item.uniq,
        count: item.count,
      }
    }
  }

  if (!p.current) {
    // fix these 2 in a bit...
    if (mappedEvents.size) {
      snapshotsQuery.filter('event', '=', Array.from(mappedEvents))
      const snapshots = await snapshotsQuery.get()
      for (const item of snapshots) {
        item.data = readGroupData(item.data)
        item.event = ctx.eventTypesInverse[item.event]
        if (!results[item.event]) {
          results[item.event] = []
        }
        results[item.event].push(item)
      }
    }

    if (individualSnapshotIds.length) {
      const snapshots = await ctx.db
        .query('snapshot', individualSnapshotIds)
        .get()
      for (const item of snapshots) {
        item.data = readGroupData(item.data)
        item.event = ctx.eventTypesInverse[item.event]
        if (!results[item.event]) {
          results[item.event] = []
        }
        results[item.event].push(item)
      }
    }
  }

  return results
}
