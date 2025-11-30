import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('edge string', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await db.setSchema({
    types: {
      other: {
        name: 'string',
      },
      user: {
        others: {
          items: {
            ref: 'other',
            prop: 'users',
            $rating: 'uint8',
            $userString: 'string',
          },
        },
      },
    },
  })

  const user1 = db.create('other')
  const user2 = db.create('other')
  const user3 = db.create('other')
  const user4 = await db.create('user', {
    others: [
      {
        id: user1,
        $rating: 5,
        $userString: 'abc',
      },
      {
        id: user2,
        $rating: 5,
        $userString: 'abc',
      },
      {
        id: user3,
        $rating: 5,
        $userString: 'abc',
      },
    ],
  })

  await db.setSchema({
    types: {
      other: {
        name: 'string',
      },
      user: {
        name: 'string',
        others: {
          items: {
            ref: 'other',
            prop: 'users',
            $rating: 'uint8',
            $userString: 'string',
          },
        },
      },
    },
  })

  deepEqual(await db.query('user').include('**').get().toObject(), [
    { id: 1, others: [{ id: 2, $string: 'abc', name: '' }] },
    { id: 2, others: [{ id: 1, $string: 'abc', name: '' }] },
  ])
})
