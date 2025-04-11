import { BasedDb } from '../src/index.js'
import { throws } from './shared/assert.js'
import test from './shared/test.js'

await test('simple min / max validation', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    locales: { en: {}, de: {} },
    types: {
      user: {
        props: {
          // u32: { type: 'uint32', validation: (v) => v > 10 },
        },
      },
    },
  })

  db.create('user', {
    u32: 100,
  })

  throws(async () => {
    db.create('user', {
      u32: 1,
    })
  })
})
