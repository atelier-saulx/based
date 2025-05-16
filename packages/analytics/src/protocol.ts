// import { ENCODER, xxHash64 } from '@based/db'
import { ClientCtx, DbTrackPayload } from './types.js'
import {
  DECODER,
  ENCODER,
  readUint16,
  readUint32,
  writeUint16,
  writeUint32,
} from '@saulx/utils'

type TempPayload = {
  event: Uint8Array
  geo: string
  active?: number
  uniq?: Set<number | string>
  count?: number
}

export const toDbPayload = async (
  events: ClientCtx['events'],
  active: ClientCtx['activeEvents'],
) => {
  const { xxHash64 } = await import('@based/db')
  let payload: TempPayload[] = []
  let size = 0
  for (const event in events) {
    for (const geo in events[event].geos) {
      const ev = events[event].geos[geo]
      const p: TempPayload = {
        event: ENCODER.encode(event),
        geo,
        count: ev.count,
      }
      // 2 geo , 2 len , 1 hasActive,  4 count, 1 hasUniq (4 len 8bytes tings),
      size += 2 + 2 + 4 + 1 + 1 + p.event.byteLength
      if (ev.uniq) {
        p.uniq = ev.uniq
        size + 4 + p.uniq.size * 8
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
        event: ENCODER.encode(event),
        geo,
        active: ev.active,
      }
      // 2 geo , 2 len even var,  1 hasActive,  4 count, 1 hasUniq,
      size += 2 + 2 + 4 + 1 + 1 + p.event.byteLength
      payload.push(p)
    }
  }
  const buf = new Uint8Array(size)

  let i = 0
  for (const p of payload) {
    ENCODER.encodeInto(p.geo, buf.subarray(i, i + 2))
    i += 2
    writeUint16(buf, p.event.byteLength, i)
    i += 2
    buf.set(p.event, i)
    i += p.event.byteLength
    if (p.active !== undefined) {
      buf[i] = 1
      i += 1
      writeUint32(buf, p.active, i)
      i += 4
    } else {
      buf[i] = 0
      i += 1
      writeUint32(buf, p.count, i)
      i += 4
    }
    if (p.uniq) {
      buf[i] = 1
      i += 1
      writeUint32(buf, p.uniq.size, i)
      i += 4
      for (const uniq of p.uniq) {
        if (typeof uniq !== 'string') {
          xxHash64(ENCODER.encode(String(uniq)), buf, i)
        } else {
          xxHash64(ENCODER.encode(uniq), buf, i)
        }
        i += 8
      }
    } else {
      buf[i] = 0
      i += 1
    }
  }
  return buf
}

export const readPayload = (buf: Uint8Array) => {
  let i = 0
  const p: DbTrackPayload[] = []
  while (i < buf.byteLength) {
    const geo = DECODER.decode(buf.subarray(i, i + 2))
    i += 2
    const eventLen = readUint16(buf, i)
    i += 2
    const event = DECODER.decode(buf.subarray(i, i + eventLen))
    i += eventLen
    const hasActive = buf[i] === 1
    i += 1
    let active: number
    let count: number = 0
    if (hasActive) {
      active = readUint32(buf, i)
      i += 4
    } else {
      count = readUint32(buf, i)
      i += 4
    }
    let uniq: Uint8Array[]
    const hasUniq = buf[i] === 1
    i += 1
    if (hasUniq) {
      uniq = []
      const amount = readUint32(buf, i)
      i += 4
      for (let j = 0; j < amount; j++) {
        uniq.push(new Uint8Array(buf.subarray(i, i + 8)))
        i += 8
      }
    }
    console.log('UNIQ', uniq, count, active, geo)
    p.push({
      geo,
      event,
      active,
      count,
      uniq,
    })
  }
  return p
}
