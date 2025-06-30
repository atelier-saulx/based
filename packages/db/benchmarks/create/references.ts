import { benchmark } from '../utils'

benchmark('create 1m items with 1 reference(s)', async (db) => {
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
  const start = performance.now()

  while (i--) {
    prevId = db.create('test', {
      refs: [prevId],
    })
  }

  await db.drain()

  return performance.now() - start
})

benchmark('create 1m items with 100 reference(s)', async (db) => {
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
  const start = performance.now()

  while (i--) {
    prevIds.push(
      db.create('test', {
        refs: prevIds,
      }),
    )
    prevIds.shift()
  }

  await db.drain()

  return performance.now() - start
})
