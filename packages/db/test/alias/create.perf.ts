import { BasedDb } from '../../src/db.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'

await test('create 1m items with an alias', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
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
