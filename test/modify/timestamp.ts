import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

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
