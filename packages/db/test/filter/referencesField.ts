import test from '../shared/test.js'
import { BasedDb } from '../../src/index.js'
import { deepEqual } from '../shared/assert.js'

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
          age: 'uint8',
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
            },
          },
        },
      },
    },
  })

  await db.create('user', {
    name: 'Mr a',
    age: 50,
    friends: [db.create('user', { name: 'Mr b', age: 25 })],
  })

  deepEqual(
    await db
      .query('user')
      .include('name', 'age', 'friends')
      .filter('friends.age', '<', 40)
      .get(),
    [
      {
        id: 2,
        age: 50,
        name: 'Mr a',
        friends: [{ id: 1, age: 25, name: 'Mr b' }],
      },
    ],
  )

  deepEqual(
    await db
      .query('user')
      .include('name', 'age', 'friends')
      .filter('friends.age', '>', 40)
      .get(),
    [
      {
        id: 1,
        age: 25,
        name: 'Mr b',
        friends: [{ id: 2, age: 50, name: 'Mr a' }],
      },
    ],
  )
})
