import { ENCODER } from '@based/db'
import { ClientCtx } from './types.js'
import { writeUint16 } from '@saulx/utils'

type TempPayload = {
  event: string
  geo: string
  active?: number
  uniq?: string[]
  count?: number
}

export const toDbPayload = (
  events: ClientCtx['events'],
  active: ClientCtx['activeEvents'],
) => {
  let payload: TempPayload[] = []
  let size = 0
  for (const event in events) {
    for (const geo in events[event].geos) {
      const ev = events[event].geos[geo]
      const p: TempPayload = {
        event: event, // ENCODER.encode(event),
        geo,
        count: ev.count,
      }
      // 2 geo , 2 len , 1 hasActive,  4 count, 1 hasUniq,
      // size += 2 + 2 + 4 + 1 + 1 + p.event.byteLength
      if (ev.uniq) {
        p.uniq = []
        for (const uniq of ev.uniq) {
          if (typeof uniq === 'number') {
            p.uniq.push(String(uniq))
          } else {
            p.uniq.push(uniq)
          }
        }
        size + 4 + p.uniq.length * 8
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
      const p: TempPayload = {
        event: event, // ENCODER.encode(event),
        geo,
        active: ev.active,
      }
      // 2 geo , 2 len even var,  1 hasActive,  4 count, 1 hasUniq,
      // size += 2 + 2 + 4 + 1 + 1 + p.event.byteLength
      payload.push(p)
    }
  }
  // const buf = new Uint8Array(size)

  // let i = 0
  // for (const p of payload) {
  //   ENCODER.encodeInto(p.geo, buf.subarray(i, i + 2))
  //   i += 2
  //   writeUint16(buf, p.event.byteLength, i)
  //   i += 2
  //   buf.set(p.event, i)
  //   i += p.event.byteLength
  //   if (p.active) {
  //     buf[i] =
  //     i += 1
  //   } else {

  //   }
  // }

  // return buf
  return payload
}
