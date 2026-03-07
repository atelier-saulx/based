import test from '../shared/test.js'
import { testDb } from '../shared/index.js'
import { isSorted } from '../shared/assert.js'

const schema = {
  types: {
    user: {
      name: 'string',
      derp: 'number',
      friends: {
        items: {
          ref: 'user',
          prop: 'friends',
        },
      },
    },
  },
} as const

await test('sort by id', async (t) => {
  const db = await testDb(t, schema)

  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      name: `user ${i}`,
      derp: i,
    })
  }

  isSorted(
    await db.query('user').include('name').order('asc').get(),
    'id',
    'asc',
  )

  isSorted(
    await db.query('user').include('name').order('desc').get(),
    'id',
    'desc',
  )

  for (let i = 1; i <= 10; i++) {
    await db.update('user', i, {
      friends: [1e6 - i * 10 - 2, 1e6 - i * 10 - 1],
    })
  }

  isSorted(
    await db.query('user').include('name', 'friends.name').range(0, 1).get(),
    'id',
    'asc',
  )
})
