import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { isSorted } from './shared/assert.js'

await test('sort timestamp', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  t.after(() => db.destroy())
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

  const eventCId = await db.create('event', {
    startTime: now + 1000,
    name: 'Event C',
  })
  const eventAId = await db.create('event', {
    startTime: now - 5000,
    name: 'Event A',
  })
  const eventBId = await db.create('event', { startTime: now, name: 'Event B' })
  const eventDId = await db.create('event', {
    startTime: now + 1000,
    name: 'Event D',
  })
  const eventZeroId = await db.create('event', {
    startTime: 0,
    name: 'Event Zero',
  })
  await db.create('event', { name: 'Event Null' })

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
    .sort('startTime', 'desc')
    .include('startTime', 'name')
    .get()

  isSorted(
    descResult,
    'startTime',
    'desc',
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
