import { BasedDb } from '../src/index.js'
import { equal } from './shared/assert.js'
import test from './shared/test.js'

await test('reffies', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        name: 'string',
        others: {
          items: {
            ref: 'user',
            prop: 'others',
            // $rating: 'number',
          },
        },
      },
    },
  })

  const userId = await db.create('user', { name: 'a' })

  await db.create('user', {
    name: 'b',
    others: [
      {
        id: userId,
        // $rating: 1,
      },
    ],
  })

  const res = await db.query('user').include('*', '**').get().toObject()

  console.dir(res, { depth: null })
})
