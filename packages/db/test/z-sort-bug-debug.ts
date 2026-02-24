import { wait } from '@based/utils'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
await test('youzi', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await db.setSchema({
    locales: {
      nl: true,
    },
    types: {
      test: {
        description: 'text',
        vision: 'text',
        updatedAt: 'timestamp',
      },
    },
  })

  db.query('test')
    .sort('updatedAt')
    .subscribe((x) => console.log, console.error)
  await wait(500)
  await db.create('test')
})
