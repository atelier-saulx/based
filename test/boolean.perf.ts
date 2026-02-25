import test from './shared/test.js'
import { testDb } from './shared/index.js'
import { perf } from './shared/assert.js'

await test('create 1m booleans', async (t) => {
  const db = await testDb(t, {
    types: {
      test: {
        boolean: 'boolean',
      },
    },
  })

  await perf(
    () => {
      db.create('test', {
        boolean: true,
      })
    },
    'create booleans',
    { repeat: 1_000_000 },
  )

  await db.drain()
})
