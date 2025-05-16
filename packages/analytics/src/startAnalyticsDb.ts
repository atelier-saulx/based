import { BasedDb, BasedDbOpts } from '@based/db'
import { AnalyticsDbCtx } from './types.js'
import { startSnapShots } from './snapShots.js'

export const startAnalyticsDb = async (
  opts: BasedDbOpts & { config?: AnalyticsDbCtx['config'] },
) => {
  const db = new BasedDb(opts)
  await db.start()
  await db.setSchema({
    types: {
      event: {
        eventId: 'uint16',
        eventName: 'string',
        lastSnapshot: 'timestamp',
        lastSnapshotId: 'uint32',
      },
      current: {
        geo: { type: 'string', maxBytes: 2 }, // later geoEnum
        event: 'uint16',
        uniq: 'cardinality',
        count: 'uint32',
      },
      snapshot: {
        event: 'uint16',
        ts: 'timestamp',
        data: 'binary',
      },
    },
  })

  const DEFAULT_CONFIG: AnalyticsDbCtx['config'] = {
    snapShotInterval: 100,
  }

  const ctx: AnalyticsDbCtx = {
    eventTypes: {},
    eventTypesInverse: {},
    currents: {},
    currentsActivePerClient: {},
    db,
    config: opts.config
      ? Object.assign(DEFAULT_CONFIG, opts.config)
      : DEFAULT_CONFIG,
    closers: [],
    populateConfig: async () => {
      const eventTypesResult = await db
        .query('event')
        .include('eventId', 'eventName', 'lastSnapshot', 'lastSnapshotId')
        .range(0, 65000)
        .get()
        .toObject()

      // js in mem info
      ctx.currents = {}
      ctx.eventTypes = {}
      ctx.eventTypesInverse = {}
      for (const ev of eventTypesResult) {
        ctx.eventTypes[ev.eventName] = ev.eventId
        ctx.currents[ev.eventId] = {
          geos: {},
          lastSnapshot: ev.lastSnapshot,
          lastSnapshotId: ev.lastSnapshotId,
        }
        ctx.eventTypesInverse[ev.eventId] = ev.eventName
      }

      const currentEventsResult = await db
        .query('current')
        .range(0, 1e6)
        .include('id', 'geo', 'event')
        .get()

      for (const c of currentEventsResult) {
        ctx.currents[c.event].geos[c.geo] = { id: c.id, active: 0 }
      }
    },
    close: async () => {
      ctx.closers.forEach((close) => close())
      db.server.emit('info', 'Close analytics db')
      return ctx.db.destroy()
    },
  }

  await ctx.populateConfig()

  const closeSnapShots = startSnapShots(ctx)
  ctx.closers.push(closeSnapShots)

  return ctx
}
