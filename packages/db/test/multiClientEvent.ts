import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test.skip('multiClientEvent', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

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
