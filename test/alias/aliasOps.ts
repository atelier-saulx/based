import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'

await test('upsert', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          externalId: 'alias',
          status: ['a', 'b'],
        },
      },
    },
  })

  const user1 = await db.create('user', {
    externalId: 'cool',
    status: 'a',
  })

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    status: 'a',
    externalId: 'cool',
  })

  await db.update('user', user1, {
    externalId: null,
    status: 'b',
  })

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    status: 'b',
    externalId: '',
  })
})
