import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { isSorted } from '../shared/assert.js'

await test('sort timestamp', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  t.after(() => t.backup(db))
  await db.start({ clean: true })

  await db.setSchema({
    types: {
      event: {
        props: {
          flap: 'number',
          startTime: 'timestamp',
          name: 'string',
        },
      },
    },
  })

  const now = Date.now()

  const eventAId = db.create('event', {
    startTime: now - 5000,
    name: 'Event A',
  })

  const eventCId = db.create('event', {
    startTime: now + 1000,
    name: 'Event C',
  })

  const eventBId = db.create('event', { startTime: now, name: 'Event B' })
  const eventDId = db.create('event', {
    startTime: now + 1000,
    name: 'Event D',
  })
  const eventZeroId = db.create('event', {
    startTime: 0,
    name: 'Event Zero',
  })
  db.create('event', { name: 'Event Null' })

  let ascResult = await db
    .query('event')
    .sort('startTime', 'asc')
    .include('startTime', 'name')
    .get()

  isSorted(
    ascResult,
    'startTime',
    'asc',
    'Ascending sort by startTime (initial)',
  )

  let descResult = await db
    .query('event')
    .sort('startTime', 'asc')
    .include('startTime', 'name')
    .get()

  isSorted(
    descResult,
    'startTime',
    'asc',
    'Descending sort by startTime (initial)',
  )

  await db.update('event', eventBId, { startTime: now + 5000 })
  await db.update('event', eventZeroId, { startTime: now - 1000 })

  ascResult = await db
    .query('event')
    .sort('startTime', 'asc')
    .include('startTime', 'name')
    .get()

  isSorted(
    ascResult,
    'startTime',
    'asc',
    'Ascending sort by startTime (after update)',
  )

  descResult = await db
    .query('event')
    .sort('startTime', 'desc')
    .include('startTime', 'name')
    .get()

  isSorted(
    descResult,
    'startTime',
    'desc',
    'Descending sort by startTime (after update)',
  )

  await db.delete('event', eventAId)
  await db.delete('event', eventDId)

  ascResult = await db
    .query('event')
    .sort('startTime', 'asc')
    .include('startTime', 'name')
    .get()

  isSorted(
    ascResult,
    'startTime',
    'asc',
    'Ascending sort by startTime (after delete)',
  )

  descResult = await db
    .query('event')
    .sort('startTime', 'desc')
    .include('startTime', 'name')
    .get()

  isSorted(
    descResult,
    'startTime',
    'desc',
    'Descending sort by startTime (after delete)',
  )
})

await test('sort multicore', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  t.after(() => t.backup(db))
  await db.start({ clean: true })

  await db.setSchema({
    types: {
      event: {
        props: {
          derp: 'boolean',
          flap: 'number',
          startTime: 'timestamp',
          name: 'string',
        },
      },
    },
  })

  for (let i = 0; i < 1000; i++) {
    await db.create('event', {
      startTime: Math.max(
        0,
        ~~(Date.now() - Math.random() * 1000 * 3600 * 24 * 30),
      ),
    })
  }

  await db.drain()

  isSorted(
    await db.query('event').sort('startTime', 'asc').get(),
    'startTime',
    'asc',
  )

  const q = []
  for (let j = 0; j < 2; j++) {
    q.push(
      (async () => {
        isSorted(
          await db.query('event').sort('startTime', 'asc').get(),
          'startTime',
          'asc',
        )
      })(),
    )
  }
  await Promise.all(q)
})
