import { BasedDb } from '../src/db.js'
import test from './shared/test.js'
import { perf } from './shared/assert.js'

await test('create 1m booleans', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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
