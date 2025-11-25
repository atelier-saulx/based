import { BasedDb } from '../src/db.js'
import test from './shared/test.js'
import { perf } from './shared/assert.js'

await test('create 1m uint32', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      test: {
        uint32: 'uint32',
      },
    },
  })

  let i = 1000_000
  await perf(async () => {
    while (i--) {
      db.create('test', { uint32: i })
    }
    await db.drain()
  }, '1M uint32')
})
