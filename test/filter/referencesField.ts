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

  const mrA = await db.create('user', {
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
    'any < 40',
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
    'any > 40',
  )

  deepEqual(
    await db
      .query('user')
      .include('name', 'age', 'friends')
      .filter('friends[*].age', '>', 40)
      .get(),
    [
      {
        id: 1,
        age: 25,
        name: 'Mr b',
        friends: [{ id: 2, age: 50, name: 'Mr a' }],
      },
    ],
    'all > 40',
  )

  deepEqual(
    await db
      .query('user')
      .include('name', 'age', 'friends')
      .filter('friends[0].age', '>', 40)
      .get(),
    [
      {
        id: 1,
        age: 25,
        name: 'Mr b',
        friends: [{ id: 2, age: 50, name: 'Mr a' }],
      },
    ],
    '[0] > 40',
  )

  for (let i = 0; i < 10; i++) {
    db.create('user', { name: 'Mr ' + i, age: 92 + i, friends: [mrA] })
  }

  deepEqual(
    await db
      .query('user', mrA)
      .include('name', 'age', 'friends')
      .filter('friends[-1].age', '>', 100)
      .get(),
    {
      id: 2,
      age: 50,
      name: 'Mr a',
      friends: [
        { id: 1, age: 25, name: 'Mr b' },
        { id: 3, age: 92, name: 'Mr 0' },
        { id: 4, age: 93, name: 'Mr 1' },
        { id: 5, age: 94, name: 'Mr 2' },
        { id: 6, age: 95, name: 'Mr 3' },
        { id: 7, age: 96, name: 'Mr 4' },
        { id: 8, age: 97, name: 'Mr 5' },
        { id: 9, age: 98, name: 'Mr 6' },
        { id: 10, age: 99, name: 'Mr 7' },
        { id: 11, age: 100, name: 'Mr 8' },
        { id: 12, age: 101, name: 'Mr 9' },
      ],
    },
    '[-1] > 100',
  )

  deepEqual(
    await db
      .query('user', mrA)
      .include('name', 'age', 'friends')
      .filter('friends[2].age', '=', 93)
      .get(),
    {
      id: 2,
      age: 50,
      name: 'Mr a',
      friends: [
        { id: 1, age: 25, name: 'Mr b' },
        { id: 3, age: 92, name: 'Mr 0' },
        { id: 4, age: 93, name: 'Mr 1' },
        { id: 5, age: 94, name: 'Mr 2' },
        { id: 6, age: 95, name: 'Mr 3' },
        { id: 7, age: 96, name: 'Mr 4' },
        { id: 8, age: 97, name: 'Mr 5' },
        { id: 9, age: 98, name: 'Mr 6' },
        { id: 10, age: 99, name: 'Mr 7' },
        { id: 11, age: 100, name: 'Mr 8' },
        { id: 12, age: 101, name: 'Mr 9' },
      ],
    },
    '[2] = 93',
  )
})
