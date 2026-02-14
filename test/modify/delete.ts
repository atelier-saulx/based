import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('delete', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        name: 'string',
      },
    },
  })

  // 1. Create
  const id = await db.create('user', { name: 'hello' })
  const res = await db.query2('user', id).get()
  deepEqual(res?.name, 'hello')

  // 2. Delete
  await db.delete('user', id)

  // 3. Verify
  const res2 = await db.query2('user', id).get()
  deepEqual(res2, null, 'Should be null after delete')

  // 4. Delete again (should not throw, maybe return false?)
  await db.delete('user', id)
})
