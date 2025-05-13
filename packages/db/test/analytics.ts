import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { allCountryCodes } from './shared/examples.js'

await test('analytics', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    props: {
      // map { }
      eventTypes: 'json', // 65k {[name]: u16 }
    },
    types: {
      current: {
        geo: [...allCountryCodes, '00'],
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

  const eventTypes: { [name: string]: number } = {}

  const currents: { [eventId: string]: { [geo: string]: number } } = {} // [name geo] - id

  const events = []

  const onStart = () => {
    // on startup get eventTypes
    // Object.keys len is current lastEventType number
    // on startup get Currents
  }

  const makeSnapshots = () => {}

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
    let eventId: number = eventTypes[geo]

    if (!eventId) {
      eventId = eventTypes[geo] = Object.keys(eventTypes).length + 1
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
    } = {
      event: eventId,
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
      event: `name-${i % 10000}`,
      geo: allCountryCodes[~~(Math.random() * allCountryCodes.length)],
      ip: `1.000${i}`,
    })
  }

  // pretty heavy 346ms per 10k events
  console.log('drain', await db.drain())
})
