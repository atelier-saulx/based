import test from '../shared/test.js'
import { perf } from '../shared/assert.js'
import { testDb } from '../shared/index.js'

await test('create 1m items with an alias', async (t) => {
  const db = await testDb(t, {
    types: {
      test: {
        alias: 'alias',
      },
    },
  })

  let i = 1000_000
  await perf(
    async () => {
      db.create('test', { alias: String(i) })
      i--

      await db.drain()
    },
    '1m items with an alias',
    { repeat: 1_000_000 },
  )
})
