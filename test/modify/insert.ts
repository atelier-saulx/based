import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('insert', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        email: 'alias',
        uuid: 'alias',
        isNice: 'boolean',
      },
    },
  })

  // 1. Create via insert
  const id1 = await db.insert(
    'user',
    { uuid: '9dg786' }, // target by alias
    { email: 'youri@saulx.com', isNice: true },
  )

  const res1 = await db.query('user', id1).get()
  deepEqual(res1, {
    id: id1,
    uuid: '9dg786',
    email: 'youri@saulx.com',
    isNice: true,
  })

  // 2. Insert with same alias (should NOT update)
  const id2 = await db.insert('user', { uuid: '9dg786' }, { isNice: false })

  deepEqual(id1, id2, 'Ids should be the same')

  const res2 = await db.query('user', id1).get()
  deepEqual(res2, {
    id: id1,
    uuid: '9dg786',
    email: 'youri@saulx.com',
    isNice: true, // Should still be true
  })

  // 3. Create another one via different alias field
  const id3 = await db.insert(
    'user',
    { email: 'bla@bla.com' },
    { uuid: 'unique-id-2', isNice: true },
  )

  const res3 = await db.query('user', id3).get()
  deepEqual(res3, {
    id: id3,
    uuid: 'unique-id-2',
    email: 'bla@bla.com',
    isNice: true,
  })

  // 4. Insert via different alias field (should NOT update)
  const id4 = await db.insert(
    'user',
    { email: 'bla@bla.com' },
    { isNice: false },
  )

  deepEqual(id3, id4, 'Ids should be the same 2')

  const res4 = await db.query('user', id3).get()
  deepEqual(res4, {
    id: id3,
    uuid: 'unique-id-2',
    email: 'bla@bla.com',
    isNice: true, // Should still be true
  })
})
