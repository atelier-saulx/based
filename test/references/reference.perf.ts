import test from '../shared/test.js'
import { perf } from '../shared/assert.js'
import { testDb } from '../shared/index.js'

await test('create 1m single refs', async (t) => {
  const db = await testDb(t, {
    types: {
      test: {
        ref: {
          ref: 'test',
          prop: 'inverseRef',
        },
      },
    },
  })

  let i = 1000_000
  let prevId = db.create('test', {})

  await perf(async () => {
    while (i--) {
      prevId = db.create('test', {
        ref: prevId,
      })
    }

    await db.drain()
  }, '1m single refs')
})
