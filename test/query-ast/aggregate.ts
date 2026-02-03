import { QueryAst } from '../../src/db-query/ast/ast.js'
import { testDb } from '../shared/index.js'

import test from '../shared/test.js'

await test('aggregate', async (t) => {
  const client = await testDb(t, {
    types: {
      user: {
        age: 'uint8',
      },
    },
  })

  const a = client.create('user', {
    age: 18,
  })

  const ast: QueryAst = {
    type: 'user',
    // aggregate: {
    //   props: {},
    // },
  }
})
