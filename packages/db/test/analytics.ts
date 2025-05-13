import { BasedDb, crc32, ENCODER, xxHash64 } from '../src/index.js'
import test from './shared/test.js'
import { allCountryCodes } from './shared/examples.js'
import { crc32 as nativeCrc32 } from '../src/index.js'
import { wait, writeUint32 } from '@saulx/utils'

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

  const currents: { [eventId: string]: { [geo: string]: number } } = {} // [name geo] - id

  const events = []

  const onStart = () => {
    // on startup get eventTypes
    // Object.keys len is current lastEventType number
    // on startup get Currents
  }

  const SNAP_SHOT_INTERVAL = 1000
  let snapShotTimer: ReturnType<typeof setTimeout>
  const makeSnapshots = async () => {
    const q = []
    for (const eventId in currents) {
      console.log(Number(eventId))
      const current = q.push(
        db
          .query('current')
          .filter('event', '=', Number(eventId))
          .groupBy('geo')
          .sum('count')
          .get(),
      )
    }
    const results = await Promise.all(q)
    console.log(results)
    snapShotTimer = setTimeout(makeSnapshots, SNAP_SHOT_INTERVAL)
  }

  snapShotTimer = setTimeout(makeSnapshots, SNAP_SHOT_INTERVAL)
  t.after(() => {
    clearTimeout(snapShotTimer)
  })

  const queryEvents = () => {
    // current
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

  for (let i = 0; i < 1e6; i++) {
    trackEvent({
      event: `name-${i % 10}`,
      geo: allCountryCodes[~~(Math.random() * allCountryCodes.length)],
      // ip: `oid${i}`,
    })
  }

  await db.query('current').get().inspect()

  console.log('drain', await db.drain())

  await wait(5e3)
})
