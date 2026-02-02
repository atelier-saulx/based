import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify enum', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        option: { enum: ['first', 'second', 'third'] },
      },
    },
  })

  const id1 = await db.create('thing', {
    option: 'first',
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    option: 'first',
  })

  await db.update('thing', id1, {
    option: 'second',
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    option: 'second',
  })
})
