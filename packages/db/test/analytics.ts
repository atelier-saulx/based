import {
  BasedDb,
  BasedQueryResponse,
  crc32,
  ENCODER,
  QueryDef,
  xxHash64,
} from '../src/index.js'
import test from './shared/test.js'
import { allCountryCodes } from './shared/examples.js'
import { crc32 as nativeCrc32 } from '../src/index.js'
import {
  convertToTimestamp,
  DECODER,
  equals,
  readUint16,
  readUint32,
  setByPath,
  wait,
  writeUint32,
} from '@saulx/utils'
import { equal } from './shared/assert.js'
import { unzip } from 'zlib'

await test('analytics', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    props: {
      eventTypes: 'json', // 65k {[name]: u16 }
    },
    types: {
      current: {
        geo: { type: 'string', maxBytes: 2 }, // later geoEnum
        event: 'uint16',
        uniq: 'cardinality',
        count: 'uint32',
        active: 'uint32',
      },
      snapshot: {
        event: 'uint16',
        ts: 'timestamp',
        // would be nice to have agg here for hll then this will just work
        data: 'binary', // [geo format]
      },
    },
  })

  // ------------------ TEMP to test on start
  await db.update({ eventTypes: { bla: 1 } })
  await db.create('current', {
    event: 1,
    count: 1,
    geo: 'NL',
  })
  // ----------------------

  let eventTypes: { [event: string]: number } = {}
  const eventTypesInverse: { [event: number]: string } = {}

  const currents: { [eventId: string]: { [geo: string]: number } } = {} // [name geo] - id

  const onStart = async () => {
    const eventTypesResult = await db
      .query()
      .include('eventTypes')
      .get()
      .toObject()
    const currentEventsResult = await db
      .query('current')
      .range(0, 1e6)
      .include('id', 'geo', 'event')
      .get()

    eventTypes = eventTypesResult.eventTypes
    for (const key in eventTypes) {
      eventTypesInverse[eventTypes[key]] = key
    }

    for (const c of currentEventsResult) {
      const currentEvents = (currents[c.event] = {})
      currentEvents[c.geo] = c.id
    }

    console.log('From start got', eventTypes, eventTypesInverse, currents)
    // on startup get eventTypes
    // Object.keys len is current lastEventType number
    // on startup get Currents
  }

  await onStart()

  const SNAP_SHOT_INTERVAL = 100

  const roundToSnapShotInterval = (nr: number | string) => {
    if (typeof nr === 'string') {
      return (
        Math.floor(convertToTimestamp(nr) / SNAP_SHOT_INTERVAL) *
        SNAP_SHOT_INTERVAL
      )
    }
    return Math.floor(nr / SNAP_SHOT_INTERVAL) * SNAP_SHOT_INTERVAL
  }

  type SnapShotWriteResult = {
    [eventId: string]: {
      size: number
      geo: {
        [geo: string]: {
          uniq: number
          count: number
          active: number
        }
      }
    }
  }
  let snapShotTimer: ReturnType<typeof setTimeout>
  let prevSnapShot: SnapShotWriteResult
  const makeSnapshots = async () => {
    await db.drain()
    const currents = await db.query('current').range(0, 1e6).get()

    const results: SnapShotWriteResult = {}

    for (const current of currents) {
      // { id: 999, geo: 'AE', event: 60, count: 31, active: 45, uniq: 31 }
      let event = results[current.event]
      if (!event) {
        event = results[current.event] = {
          size: 0,
          geo: {},
        }
      }
      event.geo[current.geo] = {
        active: current.active,
        uniq: current.uniq,
        count: current.count,
      }
      // 3 numbers + 2 (geo code)
      event.size += 12 + 2
    }

    const now = roundToSnapShotInterval(Date.now())
    for (const eventId in results) {
      const v = results[eventId]
      const data = new Uint8Array(v.size)
      let i = 0
      for (const geo in v.geo) {
        const d = v.geo[geo]
        ENCODER.encodeInto(geo, data.subarray(i, i + 2))
        i += 2
        writeUint32(data, d.active, i)
        writeUint32(data, d.uniq, i + 4)
        writeUint32(data, d.count, i + 8)
        i += 12
      }
      db.create('snapshot', {
        ts: now,
        event: Number(eventId),
        data,
      })
    }
    snapShotTimer = setTimeout(makeSnapshots, SNAP_SHOT_INTERVAL)
  }

  snapShotTimer = setTimeout(makeSnapshots, SNAP_SHOT_INTERVAL)
  t.after(() => {
    clearTimeout(snapShotTimer)
  })

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

  type SnapShotResult = {
    [event: string]: any[]
  }

  const querySnapshots = async (p: {
    start?: number | string
    end?: number | string
    events?: string[]
    resolution?: number
  }) => {
    const snapshotsQuery = db.query('snapshot')
    if (p.start) {
      snapshotsQuery.filter('ts', '>=', roundToSnapShotInterval(p.start))
    }
    if (p.end) {
      snapshotsQuery.filter('ts', '<=', roundToSnapShotInterval(p.end))
    }

    if (p.events) {
      const mappedEvents: number[] = []
      for (const ev of p.events) {
        const eventId = eventTypes[ev]
        if (eventId !== undefined) {
          mappedEvents.push(eventId)
        }
      }
      snapshotsQuery.filter('event', '=', mappedEvents)
    }

    const snapshots = await snapshotsQuery.get()

    const results: SnapShotResult = {}
    for (const item of snapshots) {
      item.data = readGroupData(item.data)
      item.event = eventTypesInverse[item.event]
      if (!results[item.event]) {
        results[item.event] = []
      }
      results[item.event].push(item)
    }

    return results
  }

  type TrackPayload = {
    event: string
    geo?: string
    ip?: string
    active?: number
  }

  const payloadToUint8Array = (payload: TrackPayload): Uint8Array => {
    let size = 2 // geo size
    const eventNameBuffer = ENCODER.encode(payload.event)
    if (eventNameBuffer.byteLength > 255) {
      throw new Error('Max len for event name is 255 bytes!')
    }
    size += 1 + eventNameBuffer.byteLength
    // size for has ip or not
    size += 1
    if (payload.ip) {
      size += 8
    }
    // size for has active or not
    size += 1
    if (payload.active) {
      size += 4
    }
    const payloadUint8 = new Uint8Array(size)
    let i = 0
    try {
      ENCODER.encodeInto(payload.geo ?? '00', payloadUint8.subarray(0, 2))
    } catch (err) {
      throw new Error(`Incorrect passed geo payload ${payload.geo}`)
    }
    i += 2
    payloadUint8[i] = eventNameBuffer.byteLength
    i += 1
    payloadUint8.set(eventNameBuffer, i)
    i += eventNameBuffer.byteLength
    if (payload.ip) {
      payloadUint8[i] = 1
      i += 1
      xxHash64(ENCODER.encode(payload.ip), payloadUint8, i)
      i += 8
    } else {
      payloadUint8[i] = 0
      i += 1
    }
    if (payload.active != undefined) {
      payloadUint8[i] = 1
      i += 1
      writeUint32(payloadUint8, payload.active, i)
      i += 4
    } else {
      payloadUint8[i] = 0
      i += 1
    }
    return payloadUint8
  }

  type DbTrackPayload = {
    event: string
    ip?: Uint8Array
    active?: number
    geo: string
  }

  const readPayload = (p: Uint8Array): DbTrackPayload => {
    let i = 0
    const geo = DECODER.decode(p.subarray(i, 2))
    i += 2
    const event = DECODER.decode(p.subarray(i + 1, p[i] + i + 1))
    i += p[i] + 1
    let ip: Uint8Array | undefined
    const hasIp = p[i] === 1
    i += 1
    if (hasIp) {
      ip = p.subarray(i, i + 8)
      i += 8
    }
    let active: number | undefined
    const hasActive = p[i] === 1
    i += 1
    if (hasActive) {
      // this has to be handled correctly!
      active = readUint32(p, i)
      i += 4
    }
    return { geo, ip, event, active }
  }

  const trackEvent = ({ geo, ip, active, event }: DbTrackPayload) => {
    let eventId: number = eventTypes[event]
    if (!eventId) {
      eventId = eventTypes[event] = Object.keys(eventTypes).length + 1
      eventTypesInverse[eventId] = event
      db.update({
        eventTypes,
      })
    }
    let currentEvents = currents[eventId]
    if (!currentEvents) {
      currentEvents = currents[eventId] = {}
    }
    let currentEventsGeo = currentEvents[geo]
    const trackPayload: {
      event: number
      count?: number | { increment: number }
      uniq?: Uint8Array
      active?: number
      geo: string
    } = {
      event: eventId,
      geo,
    }
    if (ip != undefined) {
      trackPayload.uniq = ip
    }
    if (active != undefined) {
      trackPayload.active = active
    }
    if (!currentEventsGeo) {
      trackPayload.count = 1
      currentEventsGeo = currentEvents[geo] = db.create(
        'current',
        trackPayload,
      ).tmpId
    } else {
      trackPayload.count = { increment: 1 }
      db.update('current', currentEventsGeo, trackPayload)
    }
  }

  const interval = setInterval(async () => {
    const d = performance.now()
    for (let i = 0; i < 1e5; i++) {
      trackEvent(
        readPayload(
          payloadToUint8Array({
            event: `name-${i % 100}`,
            active: ~~(Math.random() * 100),
            geo: allCountryCodes[
              ~~(Math.random() * allCountryCodes.length - 240)
            ],
            ip: `oid${i}`,
          }),
        ),
      )
    }
    const x = performance.now() - d
    console.log(
      'store 100k events',
      await db.drain(),
      x,
      'js time (and some drain)',
    )
  }, 10)

  t.after(() => {
    clearInterval(interval)
  })

  await wait(1000)
  clearInterval(interval)
  clearTimeout(snapShotTimer)

  const results = await querySnapshots({ events: ['name-0'] })

  console.dir(results, { depth: null })

  equal(results['name-0'].length > 1, true)
  // timer no time to handle nice...
  await wait(3e3)
})
