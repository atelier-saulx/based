import test from '../shared/test.js'
import { BasedDb } from '../../src/index.js'

await test('filter references shortcut', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          friends: {
            items: {
              ref: 'friends',
              prop: 'users',
            },
          },
        },
      },
    },
  })
})
