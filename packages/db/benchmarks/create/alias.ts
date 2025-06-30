import { benchmark } from '../utils'

benchmark('create 1m items with an alias', async (db) => {
  await db.setSchema({
    types: {
      test: {
        alias: 'alias',
      },
    },
  })

  const start = performance.now()

  let i = 1000_000
  while (i--) {
    db.create('test', { alias: String(i) })
  }

  await db.drain()

  return performance.now() - start
})
