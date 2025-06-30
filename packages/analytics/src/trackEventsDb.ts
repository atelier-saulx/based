import { readPayload } from './protocol.js'
import { AnalyticsDbCtx, DbTrackPayload } from './types.js'

export const trackEventDb = (
  ctx: AnalyticsDbCtx,
  clientId: number,
  { geo, uniq, active, event, count }: DbTrackPayload,
) => {
  let eventId: number = ctx.eventTypes[event]
  let currentEvents = ctx.currents[eventId]
  if (!eventId) {
    eventId = ctx.eventTypes[event] = Object.keys(ctx.eventTypes).length + 1
    ctx.eventTypesInverse[eventId] = event
    ctx.db.create('event', {
      eventId,
      eventName: event,
    })
    currentEvents = ctx.currents[eventId] = {
      geos: {},
      lastSnapshot: 0,
      lastSnapshotId: 0,
    }
  }

  // db payload
  const trackPayload: {
    event: number
    count?: number | { increment: number }
    uniq?: Uint8Array[]
    geo: string
  } = {
    event: eventId,
    geo,
  }
  if (uniq != undefined) {
    trackPayload.uniq = uniq
  }

  let currentEventsGeo = currentEvents.geos[geo]
  if (!currentEventsGeo) {
    trackPayload.count = count
    currentEventsGeo = currentEvents.geos[geo] = {
      id: ctx.db.create('current', trackPayload).tmpId,
      active: 0,
    }
  } else {
    trackPayload.count = { increment: count }
    ctx.db.update('current', currentEventsGeo.id, trackPayload)
  }

  if (active != undefined) {
    let clientActiveCurrents = ctx.currentsActivePerClient[clientId]
    if (!clientActiveCurrents) {
      clientActiveCurrents = ctx.currentsActivePerClient[clientId] = {}
    }
    let clientActiveCurrentsEvent = clientActiveCurrents[eventId]
    if (!clientActiveCurrentsEvent) {
      clientActiveCurrentsEvent = clientActiveCurrents[eventId] = { geos: {} }
    }

    clientActiveCurrentsEvent.geos[geo] = active
    currentEventsGeo.active = 0
    for (const client in ctx.currentsActivePerClient) {
      const clientActiveEvent = ctx.currentsActivePerClient[client][eventId]
      if (clientActiveEvent) {
        const gevent = clientActiveEvent.geos[geo]
        if (gevent) {
          currentEventsGeo.active += gevent
        }
      }
    }
  }
}

export const receivePayload = (
  ctx: AnalyticsDbCtx,
  clientId: number,
  buf: Uint8Array,
) => {
  if (ctx.db.server.stopped) {
    return
  }
  const events = readPayload(buf)
  for (const p of events) {
    trackEventDb(ctx, clientId, p)
  }
}
