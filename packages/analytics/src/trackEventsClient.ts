import { toDbPayload } from './protocol.js'
import { ClientCtx, TrackPayload } from './types.js'

export const createClientCtx = (
  flush: (dbPayload: ReturnType<typeof toDbPayload>) => Promise<void>,
  flushTime: number = 1000,
) => {
  let killed = false
  let timer: ReturnType<typeof setTimeout>
  const clientCtx: ClientCtx = {
    events: {},
    activeEvents: {},
    close: () => {
      killed = true
      clearTimeout(timer)
    },
    flushTime,
  }
  const flushTimer = async () => {
    const events = clientCtx.events
    clientCtx.events = {}
    await flush(toDbPayload(events, clientCtx.activeEvents))
    for (const active in clientCtx.activeEvents) {
      const a = clientCtx.activeEvents[active]
      let cnt = 0
      for (const geo in a.geos) {
        cnt++
        if (a.geos[geo].active === 0) {
          cnt--
          delete a.geos[geo]
        }
      }
      if (cnt === 0) {
        delete clientCtx.activeEvents[active]
      }
    }
    if (!killed) {
      timer = setTimeout(flushTimer, clientCtx.flushTime)
    }
  }
  timer = setTimeout(flushTimer, clientCtx.flushTime)
  return clientCtx
}

export const trackEvent = (ctx: ClientCtx, p: TrackPayload) => {
  const ev = p.event
  ctx.events[ev] ??= { geos: {} }
  const target = (ctx.events[ev].geos[p.geo] ??= { count: 0 })
  target.count += 1
}

export const trackActive = (
  ctx: ClientCtx,
  p: { geo: string; event: string; active: number },
) => {
  const ev = p.event
  ctx.activeEvents[ev] ??= { geos: {} }
  const target = (ctx.activeEvents[ev].geos[p.geo] ??= {
    active: 0,
    prevActive: -1,
  })
  target.active = p.active
}
