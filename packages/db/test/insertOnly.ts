import { BasedDb } from '../src/index.js'
import { throws } from './shared/assert.js'
import test from './shared/test.js'

await test('rootProps', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(async () => t.backup(db))

  await db.setSchema({
    types: {
      audit: {
        insertOnly: true,
        props: {
          v: { type: 'number' },
        },
      },
    },
  })

  const a = await db.create('audit', { v: 100 })
  await db.create('audit', { v: 100 })
  await throws(() => db.delete('audit', a))
})
