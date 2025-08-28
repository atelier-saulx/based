import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('filter api: object', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        bestFriend: {
          ref: 'user',
          prop: 'bestFriend',
        },
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })

  for (let i = 0; i < 10; i++) {
    db.create('user', {
      friends: i > 0 ? [i] : [],
      bestFriend: i > 0 ? i : null,
    })
  }

  deepEqual(
    await db
      .query('user')
      .include('friends')
      .filter('friends', 'includes', { id: 2 })
      .get(),
    [
      { id: 1, friends: [{ id: 2 }] },
      { id: 3, friends: [{ id: 2 }, { id: 4 }] },
    ],
    'object in refs has',
  )

  deepEqual(
    await db
      .query('user')
      .include('friends')
      .filter('friends', 'includes', [{ id: 2 }, { id: 1 }])
      .get(),
    [
      { id: 1, friends: [{ id: 2 }] },
      { id: 2, friends: [{ id: 1 }, { id: 3 }] },
      { id: 3, friends: [{ id: 2 }, { id: 4 }] },
    ],
    'object in refs has (array)',
  )

  deepEqual(
    await db.query('user').filter('bestFriend', '=', { id: 9 }).get(),
    [
      {
        id: 10,
      },
    ],
    'object in ref has',
  )

  deepEqual(
    await db
      .query('user')
      .filter('bestFriend', '=', [{ id: 9 }, { id: 10 }])
      .get(),
    [
      {
        id: 9,
      },
      {
        id: 10,
      },
    ],
    'object in ref has (array)',
  )
})
