import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('checksum', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      article: {
        body: 'string',
      },
    },
  })

  const article1 = await db.create('article', {
    body: 'party in the house',
  })

  await db.query('article').include('*', '_checksum')
})
