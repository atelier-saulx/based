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

  const query = db
    .query2('user')
    .include('isNice', 'name', 'otherUsers.name')
    .include((select) =>
      select('otherUsers').include('name').filter('name', '=', 'youzi'),
    )
    .filter('otherUsers.name', '=', 'youzi')

  console.dir(query.ast, { depth: null })
})
