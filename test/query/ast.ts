import { $buffer } from '../../src/db-client/query2/result.js'
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

  db.create('user', {
    isNice: true,
  })

  const query = db.query2('user').include('isNice', 'name', 'otherUsers.name')
  // .include((select) =>
  //   select('otherUsers').include('name').filter('name', '=', 'youzi'),
  // )
  // .filter('otherUsers.name', '=', 'youzi')

  console.dir(query.ast, { depth: null })
  const proxy = await query.get()
  console.log('-----------')
  proxy
  console.log('-----------1')
  // proxy.forEach((a, b, c) => console.log('WAZZUP', { a, b, c }))
  for (const i of proxy) {
    console.log({ i })
  }

  console.log('-->', proxy[$buffer])

  //
})
