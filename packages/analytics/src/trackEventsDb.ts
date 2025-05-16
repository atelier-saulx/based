import { AnalyticsDbCtx, DbTrackPayload } from './types.js'

export const trackEvent = (
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
  if (active != undefined) {
    console.log('hello ACTIVE', 'myesh', clientId)
    let clientActiveCurrents = ctx.currentsActivePerClient[clientId]
    if (!clientActiveCurrents) {
      clientActiveCurrents = ctx.currentsActivePerClient[clientId] = {}
    }
    //
    // this needs different handling
    // trackPayload.active = active
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
}
