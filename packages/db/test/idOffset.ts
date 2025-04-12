import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('idOffset', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
    types: {
      transaction: {
        props: {
          key: 'alias', // `${round}-${fingerprint}`
        },
      },
    },
  })
})
