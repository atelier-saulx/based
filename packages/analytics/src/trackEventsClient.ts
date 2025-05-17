import { toDbPayload } from './protocol.js'
import type { ClientCtx, TrackPayload } from './types.js'

export const createClientCtx = (
  flush: (dbPayload: ReturnType<typeof toDbPayload>) => Promise<void>,
  preflush?: () => void,
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
    preflush?.()
    const events = clientCtx.events
    clientCtx.events = {}

    const active = clientCtx.activeEvents
    clientCtx.activeEvents = {}

    const buf = toDbPayload(events, active)
    if (buf.byteLength) {
      await flush(buf)
    }
    // for (const active in clientCtx.activeEvents) {
    //   const a = clientCtx.activeEvents[active]
    //   let cnt = 0
    //   for (const geo in a.geos) {
    //     cnt++
    //     if (a.geos[geo].active === a.geos[geo].prevActive) {
    //       console.log('delete geo', geo)
    //       cnt--
    //       delete a.geos[geo]
    //     } else {
    //       a.geos[geo].prevActive = a.geos[geo].active
    //     }
    //   }
    //   if (cnt === 0) {
    //     delete clientCtx.activeEvents[active]
    //   }
    // }
    if (!killed) {
      timer = setTimeout(flushTimer, clientCtx.flushTime)
    }
  }
  timer = setTimeout(flushTimer, clientCtx.flushTime)
  return clientCtx
}

export const trackEvent = (ctx: ClientCtx, p: TrackPayload) => {
  if (!p.geo) {
    p.geo = '00'
  }
  const ev = p.event
  ctx.events[ev] ??= { geos: {} }
  const target = (ctx.events[ev].geos[p.geo] ??= { count: 0 })
  if (p.uniq) {
    if (!target.uniq) {
      target.uniq = new Set()
    }
    target.uniq.add(p.uniq)
  }
  target.count += 1
}

export const trackActive = (
  ctx: ClientCtx,
  p: { geo?: string; event: string; active: number },
) => {
  if (!p.geo) {
    p.geo = '00'
  }
  const ev = p.event
  ctx.activeEvents[ev] ??= { geos: {} }
  // if target is the same
  const target = (ctx.activeEvents[ev].geos[p.geo] ??= {
    active: -1,
    prevActive: -1,
  })
  // if (p.active === target.active || p.active < 0) {
  //   // console.log('is same ignore')
  //   return
  // }
  target.active = p.active
}
