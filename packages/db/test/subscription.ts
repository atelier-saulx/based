import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import { wait } from '@saulx/utils'

await test('subscription hook', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
        },
      },
    },
  })

  db.query('user').subscribe((res) => {
    // lastRes = res.toObject()
  })
})
