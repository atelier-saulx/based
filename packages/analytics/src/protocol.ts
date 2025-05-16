import { ClientCtx } from './types.js'

export const toDbPayload = (
  events: ClientCtx['events'],
  active: ClientCtx['activeEvents'],
) => {
  let payload = []
  let size = 0
  for (const event in events) {
    for (const geo in events[event].geos) {
      const ev = events[event].geos[geo]
      const p: any = {
        event,
        geo,
        count: ev.count,
      }
      if (ev.uniq) {
        p.uniq = []
        for (const uniq of ev.uniq) {
          if (typeof uniq === 'number') {
            p.uniq.push(String(uniq))
          } else {
            p.uniq.push(uniq)
          }
        }
      }
      payload.push(p)
    }
  }
  for (const event in active) {
    for (const geo in active[event].geos) {
      const ev = active[event].geos[geo]
      if (ev.prevActive === ev.active) {
        continue
      }
      ev.prevActive = ev.active
      const p: any = {
        event,
        geo,
        active: ev.active,
      }
      payload.push(p)
    }
  }
  return payload
}
