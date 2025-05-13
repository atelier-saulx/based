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
  readUint16,
  readUint32,
  setByPath,
  wait,
  writeUint32,
} from '@saulx/utils'

await test('analytics', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const geoEnum = [...allCountryCodes, '00']

  await db.setSchema({
    props: {
      // map { }
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
        data: 'binary', // [geo format]
      },
    },
  })

  const eventTypes: { [event: string]: number } = {}
  const eventTypesInverse: { [event: number]: string } = {}

  const currents: { [eventId: string]: { [geo: string]: number } } = {} // [name geo] - id

  const events = []

  const onStart = () => {
    // on startup get eventTypes
    // Object.keys len is current lastEventType number
    // on startup get Currents
  }

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

  let snapShotTimer: ReturnType<typeof setTimeout>
  const makeSnapshots = async () => {
    await db.drain()
    const q: Promise<BasedQueryResponse>[] = []
    for (const eventId in currents) {
      const current = q.push(
        db
          .query('current')
          .filter('event', '=', Number(eventId))
          .groupBy('geo')
          .sum('count', 'active')
          .get(),
      )
    }
    const results = await Promise.all(q)
    const now = roundToSnapShotInterval(Date.now())
    results.forEach((v) => {
      const eventId = readUint16(v.def.filter.conditions.get(0)[0], 8)
      db.create('snapshot', {
        ts: now,
        event: eventId,
        data: v.result,
      })
    })
    console.log('created snap shots', await db.drain())
    snapShotTimer = setTimeout(makeSnapshots, SNAP_SHOT_INTERVAL)
  }

  snapShotTimer = setTimeout(makeSnapshots, SNAP_SHOT_INTERVAL)
  t.after(() => {
    clearTimeout(snapShotTimer)
  })

  const readAggregate = (
    q: QueryDef,
    result: Uint8Array,
    offset: number,
    len: number,
  ) => {
    const results = {}
    if (q.aggregate.groupBy) {
      let i = offset
      while (i < len) {
        let key: string = ''
        if (result[i] == 0) {
          if (q.aggregate.groupBy.default) {
            key = q.aggregate.groupBy.default
          } else {
            key = `$undefined`
          }
        } else {
          key = DECODER.decode(result.subarray(i, i + 2))
        }
        i += 2
        const resultKey = (results[key] = {})
        for (const aggregatesArray of q.aggregate.aggregates.values()) {
          for (const agg of aggregatesArray) {
            setByPath(
              resultKey,
              agg.propDef.path,
              readUint32(result, agg.resultPos + i),
            )
          }
        }
        i += q.aggregate.totalResultsPos
      }
    }
    return results
  }

  const readGroupData = (q: any, result: any) => {
    if (q.aggregate) {
      return readAggregate(q, result, 0, result.byteLength - 4)
    }
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

    const q = db.query('current').groupBy('geo').sum('count', 'active')
    q.register()
    const results = {}
    for (const item of snapshots) {
      item.data = readGroupData(q.def, item.data)
      item.event = eventTypesInverse[item.event]
      if (!results[item.event]) {
        results[item.event] = []
      }
      results[item.event].push(item)
    }

    return results
  }

  const trackEvent = (p: {
    event: string
    geo?: string
    ip?: string
    active?: number
  }) => {
    let geo: string = p.geo || '00'
    let eventId: number = eventTypes[p.event]

    if (!eventId) {
      eventId = eventTypes[p.event] = Object.keys(eventTypes).length + 1
      eventTypesInverse[eventId] = p.event
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
      uniq?: string
      active?: number
      geo: string
    } = {
      event: eventId,
      geo,
    }

    if (p.ip) {
      trackPayload.uniq = p.ip
    }

    if (p.active) {
      trackPayload.active = p.active
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
      trackEvent({
        event: `name-${i % 100}`,
        active: ~~(Math.random() * 100),
        geo: allCountryCodes[~~(Math.random() * allCountryCodes.length - 240)],
        // ip: `oid${i}`,
      })
    }
    const x = performance.now() - d
    console.log(
      'store 1M events',
      await db.drain(),
      x,
      'js time (and some drain)',
    )
  }, 10)

  t.after(() => {
    clearInterval(interval)
  })

  await db.query('current').get().inspect()

  await wait(2000)
  clearInterval(interval)
  clearTimeout(snapShotTimer)

  console.dir(await querySnapshots({ events: ['name-0'] }), { depth: null })

  // timer no time to handle nice...
  await wait(3e3)
})
