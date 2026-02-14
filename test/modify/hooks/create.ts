import { deepEqual, testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - hooks - create', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          rating: {
            type: 'number',
            hooks: {
              create(value) {
                if (value < 5) {
                  return value + 1
                }
              },
            },
          },
        },
        hooks: {
          create(payload) {
            if (!payload.rating) {
              payload.rating = 5
            }
          },
        },
      },
    },
  })

  {
    const id = await db.create('user', {})
    deepEqual(await db.query2('user', id).get(), {
      id,
      rating: 5,
    })
  }
})
