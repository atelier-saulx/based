import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('include ', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          nr: 'uint32',
          friends: {
            items: { ref: 'user', prop: 'friends', $rating: 'number' },
          },
        },
      },
    },
  })

  db.create('user', {
    nr: 2,
    friends: [{ id: db.create('user', { nr: 1 }), $rating: 1 }],
  })
  db.create('user', { nr: 3 })

  deepEqual(
    await db.query('user').include([]).range(0, 5).get(),
    [
      {
        id: 1,
      },
      {
        id: 2,
      },
      {
        id: 3,
      },
    ],
    'empty array should return nothing',
  )

  equal((await db.query('user', 1).get()).id, 1)

  equal((await db.query('user', 1).get()).queryId, 3978712180)
})
