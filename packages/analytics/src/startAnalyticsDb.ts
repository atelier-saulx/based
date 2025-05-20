import { BasedDb, BasedDbOpts } from '@based/db'
import { AnalyticsDbCtx } from './types.js'
import { startSnapShots } from './snapShots.js'

export const unregisterClient = (ctx: AnalyticsDbCtx, clientId: number) => {
  const clientActiveCurrents = ctx.currentsActivePerClient[clientId]
  if (!clientActiveCurrents) {
    ctx.db.server.emit(
      'info',
      'trying to remove actives from a client that has no actives',
    )
    return
  }
  ctx.db.server.emit('info', 'unregistering client')
  for (const eventId in clientActiveCurrents) {
    const ev = clientActiveCurrents[eventId]
    for (const geo in ev.geos) {
      const currentGeo = ctx.currents[eventId].geos[geo]
      currentGeo.active -= ev.geos[geo]
    }
  }
  delete ctx.currentsActivePerClient[clientId]
}

export const startAnalyticsDb = async (
  opts: BasedDbOpts & {
    config?: AnalyticsDbCtx['config']
    clean?: boolean
    db?: BasedDb
  },
) => {
  const db = opts.db ?? new BasedDb(opts)
  if (!opts.db) {
    if (opts.clean) {
      await db.start({ clean: opts.clean })
    } else {
      await db.start()
    }
  }
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
    snapShotInterval: 1e3 * 15, // 15 seconds
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
      if (!opts.db) {
        return ctx.db.stop()
      }
    },
  }

  await ctx.populateConfig()

  const closeSnapShots = startSnapShots(ctx)
  ctx.closers.push(closeSnapShots)

  return ctx
}
