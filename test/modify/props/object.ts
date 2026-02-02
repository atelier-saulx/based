import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify object', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        info: {
          type: 'object',
          props: {
            title: 'string',
            count: 'number',
          },
        },
      },
    },
  })

  const id1 = await db.create('thing', {
    info: {
      title: 'my title',
      count: 10,
    },
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    info: {
      title: 'my title',
      count: 10,
    },
  })

  // Partial update of object
  await db.update('thing', id1, {
    info: {
      count: 20,
    },
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    info: {
      title: 'my title',
      count: 20,
    },
  })
})
