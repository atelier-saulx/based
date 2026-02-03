import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('query types', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        name: 'string',
        isNice: 'boolean',
        otherUsers: {
          items: {
            ref: 'user',
            prop: 'otherUsers',
          },
        },
      },
    },
  })

  await db.create('user', {
    isNice: true,
  })

  const query = db
    .query2('user')
    .include('isNice', 'name')
    .include((select) => select('otherUsers').include('name'))

  const result = query.get()
})
