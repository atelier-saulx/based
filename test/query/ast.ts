import { $buffer } from '../../src/db-client/query2/result.js'
import { deepEqual, testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('query ast creation', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
      nl: true,
    },
    types: {
      user: {
        name: 'string',
        isNice: 'boolean',
      },
    },
  })

  {
    const query = db
      .query2('user')
      .filter('isNice', '=', false)
      .and('name', '=', 'youzi')

    deepEqual(query.ast, {
      type: 'user',
      filter: {
        props: {
          isNice: { ops: [{ op: '=', val: false }] },
          name: { ops: [{ op: '=', val: 'youzi' }] },
        },
      },
    })
  }

  {
    const query = db
      .query2('user')
      .filter('isNice', '=', false)
      .and('name', '=', 'youzi')
      .or('name', '=', 'james')

    deepEqual(query.ast, {
      type: 'user',
      filter: {
        props: {
          isNice: { ops: [{ op: '=', val: false }] },
          name: { ops: [{ op: '=', val: 'youzi' }] },
        },
        or: {
          props: {
            name: { ops: [{ op: '=', val: 'james' }] },
          },
        },
      },
    })
  }

  {
    const query = db
      .query2('user')
      .filter('isNice', '=', false)
      .and('name', '=', 'youzi')
      .or('name', '=', 'james')
      .and('isNice', '=', false)

    deepEqual(query.ast, {
      type: 'user',
      filter: {
        props: {
          isNice: { ops: [{ op: '=', val: false }] },
          name: { ops: [{ op: '=', val: 'youzi' }] },
        },
        or: {
          props: {
            name: { ops: [{ op: '=', val: 'james' }] },
            isNice: { ops: [{ op: '=', val: false }] },
          },
        },
      },
    })
  }

  {
    const query = db
      .query2('user')
      .filter((filter) => filter('name', '=', 'youzi').or('isNice', '=', true))
      .or((filter) => filter('name', '=', 'james').or('isNice', '=', false))

    deepEqual(query.ast, {
      type: 'user',
      filter: {
        and: {
          props: {
            name: { ops: [{ op: '=', val: 'youzi' }] },
          },
          or: {
            props: {
              isNice: { ops: [{ op: '=', val: true }] },
            },
          },
        },
        or: {
          props: {
            name: { ops: [{ op: '=', val: 'james' }] },
          },
          or: {
            props: {
              isNice: { ops: [{ op: '=', val: false }] },
            },
          },
        },
      },
    })
  }
})
