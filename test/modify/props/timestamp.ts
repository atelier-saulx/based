import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify timestamp', async (t) => {
  const db = await testDb(t, {
    types: {
      event: {
        ts: 'timestamp',
      },
    },
  })

  const t1 = Date.now()
  const t2 = t1 + 1000
  const t3 = t1 + 2000

  const id1 = await db.create('event', {
    ts: t1,
  })

  deepEqual(await db.query('event', id1).get(), {
    id: id1,
    ts: t1,
  })

  await db.update('event', id1, {
    ts: t2,
  })

  deepEqual(await db.query('event', id1).get(), {
    id: id1,
    ts: t2,
  })

  await db.update('event', id1, {
    ts: t3,
  })

  deepEqual(await db.query('event', id1).get(), {
    id: id1,
    ts: t3,
  })

  // Edge cases
  await db.update('event', id1, { ts: 0 })
  deepEqual(await db.query('event', id1).get(), { id: id1, ts: 0 })

  const farFuture = 8640000000000000 // Max JS Date timestamp
  await db.update('event', id1, { ts: farFuture })
  deepEqual(await db.query('event', id1).get(), { id: id1, ts: farFuture })

  // Increment
  await db.update('event', id1, { ts: 1000 })
  await db.update('event', id1, {
    ts: { increment: 1000 },
  })
  deepEqual(await db.query('event', id1).get(), { id: id1, ts: 2000 })

  await db.update('event', id1, {
    ts: { increment: -500 },
  })
  deepEqual(await db.query('event', id1).get(), { id: id1, ts: 1500 })

  // String formats
  const now = Date.now()
  await db.update('event', id1, { ts: 'now' })
  const r1: any = await db.query('event', id1).get()
  if (Math.abs(r1.ts - now) > 200) {
    throw new Error(`Timestamp 'now' is too far off: ${r1.ts} vs ${now}`)
  }

  await db.update('event', id1, { ts: 'now + 1h' })
  const r2: any = await db.query('event', id1).get()
  const t2Expr = now + 1000 * 60 * 60
  if (Math.abs(r2.ts - t2Expr) > 200) {
    throw new Error(
      `Timestamp 'now + 1h' is too far off: ${r2.ts} vs ${t2Expr}`,
    )
  }

  await db.update('event', id1, { ts: 'now - 1d' })
  const r3: any = await db.query('event', id1).get()
  const t3Expr = now - 1000 * 60 * 60 * 24
  if (Math.abs(r3.ts - t3Expr) > 200) {
    throw new Error(
      `Timestamp 'now - 1d' is too far off: ${r3.ts} vs ${t3Expr}`,
    )
  }

  // Explicit date string
  const dateStr = '2025-01-01T00:00:00.000Z'
  const dateTs = new Date(dateStr).valueOf()
  await db.update('event', id1, { ts: dateStr })
  const r4: any = await db.query('event', id1).get()
  deepEqual(r4, { id: id1, ts: dateTs })
})

await test('modify timestamp on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      event: {
        ts: 'timestamp',
      },
      holder: {
        toEvent: {
          ref: 'event',
          prop: 'holders',
          $edgeTs: 'timestamp',
        },
      },
    },
  })

  const eventId = await db.create('event', { ts: Date.now() })

  const t1 = Date.now()
  const t2 = t1 + 1000
  const t3 = t1 + 2000

  const id1 = await db.create('holder', {
    toEvent: {
      id: eventId,
      $edgeTs: t1,
    },
  })

  // Helper
  const getEdgeTs = async (id: number) => {
    const res = await db
      .query('holder', id)
      .include('toEvent.$edgeTs')
      .get()
      .toObject()
    return res.toEvent?.$edgeTs || 0
  }

  deepEqual(await getEdgeTs(id1), t1)

  // Update
  await db.update('holder', id1, {
    toEvent: {
      id: eventId,
      $edgeTs: t2,
    },
  })
  deepEqual(await getEdgeTs(id1), t2)

  await db.update('holder', id1, {
    toEvent: {
      id: eventId,
      $edgeTs: t3,
    },
  })
  deepEqual(await getEdgeTs(id1), t3)

  // Edge cases
  await db.update('holder', id1, { toEvent: { id: eventId, $edgeTs: 0 } })
  deepEqual(await getEdgeTs(id1), 0)

  const farFuture = 8640000000000000
  await db.update('holder', id1, {
    toEvent: { id: eventId, $edgeTs: farFuture },
  })
  deepEqual(await getEdgeTs(id1), farFuture)

  // Increment
  await db.update('holder', id1, { toEvent: { id: eventId, $edgeTs: 1000 } })
  await db.update('holder', id1, {
    toEvent: {
      id: eventId,
      $edgeTs: { increment: 1000 },
    },
  })
  deepEqual(await getEdgeTs(id1), 2000)

  await db.update('holder', id1, {
    toEvent: {
      id: eventId,
      $edgeTs: { increment: -500 },
    },
  })
  deepEqual(await getEdgeTs(id1), 1500)

  // String formats
  const now = Date.now()
  await db.update('holder', id1, { toEvent: { id: eventId, $edgeTs: 'now' } })
  const r1 = await getEdgeTs(id1)
  if (Math.abs(r1 - now) > 200) {
    throw new Error(`Timestamp 'now' is too far off: ${r1} vs ${now}`)
  }

  await db.update('holder', id1, {
    toEvent: { id: eventId, $edgeTs: 'now + 1h' },
  })
  const r2 = await getEdgeTs(id1)
  const t2Expr = now + 1000 * 60 * 60
  if (Math.abs(r2 - t2Expr) > 200) {
    throw new Error(`Timestamp 'now + 1h' is too far off: ${r2} vs ${t2Expr}`)
  }

  await db.update('holder', id1, {
    toEvent: { id: eventId, $edgeTs: 'now - 1d' },
  })
  const r3 = await getEdgeTs(id1)
  const t3Expr = now - 1000 * 60 * 60 * 24
  if (Math.abs(r3 - t3Expr) > 200) {
    throw new Error(`Timestamp 'now - 1d' is too far off: ${r3} vs ${t3Expr}`)
  }

  // Explicit date string
  const dateStr = '2025-01-01T00:00:00.000Z'
  const dateTs = new Date(dateStr).valueOf()
  await db.update('holder', id1, { toEvent: { id: eventId, $edgeTs: dateStr } })
  deepEqual(await getEdgeTs(id1), dateTs)
})
