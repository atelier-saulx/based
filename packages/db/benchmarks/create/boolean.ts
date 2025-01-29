import { benchmark } from '../utils'

benchmark('create 1m booleans', async (db) => {
  db.putSchema({
    types: {
      test: {
        boolean: 'boolean',
      },
    },
  })

  const start = performance.now()

  let i = 1000_000
  while (i--) {
    db.create('test', {
      boolean: true,
    })
  }

  await db.drain()

  return performance.now() - start
})
