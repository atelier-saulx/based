import { BasedDb } from '../../src/db.js'
import test from '../shared/test.js'
import { deepEqual, equal, throws, perf } from '../shared/assert.js'

await test('create 1m items with 1 reference(s)', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      test: {
        refs: {
          items: {
            ref: 'test',
            prop: 'inverseRef',
          },
        },
      },
    },
  })

  let i = 1000_000
  let prevId = db.create('test', {})

  await perf(async () => {
    while (i--) {
      prevId = db.create('test', {
        refs: [prevId],
      })
    }

    await db.drain()
  }, '1m items with 1 reference(s)')
})

await test('create 1m items with 100 reference(s)', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      test: {
        refs: {
          items: {
            ref: 'test',
            prop: 'inverseRef',
          },
        },
      },
    },
  })

  let i = 1000_000
  let prevIds = Array.from({ length: 100 }).map(() => db.create('test', {}))

  await perf(async () => {
    while (i--) {
      prevIds.push(
        db.create('test', {
          refs: prevIds,
        }),
      )
      prevIds.shift()
    }
    await db.drain()
  }, '1m items with 100 reference(s)')
})
