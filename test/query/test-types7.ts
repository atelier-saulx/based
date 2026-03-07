import { testDb } from '../shared/index.js'
import test from '../shared/test.js'
import { PickOutput } from '../../src/db-query/query/types.js'

test('test setup types', async (t) => {
  const db = await testDb(t, {
    locales: { en: true },
    types: {
      user: {
        isNice: 'boolean',
      },
    },
  })

  type UserK = '*'
  type O = PickOutput<
    {
      types: { user: { props: { isNice: { type: 'boolean' } } } }
      locales: {}
    },
    'user',
    UserK
  >
  const o: O = { id: 1, isNice: true } // Works?
})
