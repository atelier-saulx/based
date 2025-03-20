import { benchmark } from '../utils'

benchmark('create 1m single refs', async (db) => {
  db.setSchema({
    types: {
      test: {
        ref: {
          ref: 'test',
          prop: 'inverseRef',
        },
      },
    },
  })

  const start = performance.now()

  let i = 1000_000
  let prevId = db.create('test', {})
  while (i--) {
    prevId = db.create('test', {
      ref: prevId,
    })
  }

  await db.drain()

  return performance.now() - start
})
