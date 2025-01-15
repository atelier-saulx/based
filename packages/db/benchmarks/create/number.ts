import { benchmark } from '../utils'

benchmark('create 1m uint32', async (db) => {
  db.putSchema({
    types: {
      test: {
        uint32: 'uint32',
      },
    },
  })

  const start = performance.now()

  let i = 1000_000
  while (i--) {
    db.create('test', { uint32: i })
  }

  db.drain()

  return performance.now() - start
})
