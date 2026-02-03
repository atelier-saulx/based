import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify binary', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        blob: 'binary',
      },
    },
  })

  const b1 = new Uint8Array([1, 2, 3])
  const id1 = await db.create('thing', {
    blob: b1,
  })
  const res1 = await db.query('thing', id1).get().toObject()

  deepEqual(res1.blob, b1)

  const b2 = new Uint8Array([4, 5, 6, 7])
  await db.update('thing', id1, {
    blob: b2,
  })

  const res2 = await db.query('thing', id1).get().toObject()
  deepEqual(res2.blob, b2)
})
