import { benchmark } from './benchmarks/utils.js'

benchmark('create 1m 2char strings', async (db) => {
  await db.setSchema({
    types: {
      test: {
        string: 'string',
      },
    },
  })

  const string = 'aa'
  const start = performance.now()

  let i = 1000_000
  while (i--) {
    db.create('test', { string })
  }

  await db.drain()

  return performance.now() - start
})

benchmark('create 1m 1000char strings', async (db) => {
  await db.setSchema({
    types: {
      test: {
        string: 'string',
      },
    },
  })

  const string = Array.from({ length: 1000 }).fill('a').join()
  const start = performance.now()

  let i = 1000_000
  while (i--) {
    db.create('test', { string })
  }

  await db.drain()

  return performance.now() - start
})
