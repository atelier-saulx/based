import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'

await test('create 1m single refs', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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
