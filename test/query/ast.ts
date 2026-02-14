import { query } from '../../src/db-client/query2/index.js'
import { deepEqual, testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('query ast creation', async (t) => {
  type Schema = {
    locales: {
      en: true
      nl: true
    }
    types: {
      user: {
        friend: {
          ref: 'user'
          prop: 'friend'
          $rating: 'uint32'
        }
        name: 'string'
        isNice: 'boolean'
        age: 'number'
      }
    }
  }

  {
    const q = query('user')
      .filter('isNice', '=', false)
      .and('name', '=', 'youzi')

    deepEqual(q.ast, {
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
    const q = query<Schema>('user')
      .filter('isNice', '=', false)
      .and('name', '=', 'youzi')
      .or('name', '=', 'james')

    deepEqual(q.ast, {
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
    const q = query<Schema>('user')
      .include('age')
      .filter('name', 'includes', 'jim')
      .and((f) => f('age', '>', 2))

    // .filter('isNice', '=', false)
    // .and('name', '=', 'youzi')
    // .or('name', '=', 'james')
    // .and('isNice', '=', false)

    deepEqual(q.ast, {
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
    const q = query<Schema>('user')
      .filter((filter) => filter('name', '=', 'youzi').or('isNice', '=', true))
      .or((filter) => filter('name', '=', 'james').or('isNice', '=', false))

    deepEqual(q.ast, {
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

  {
    const q = query<Schema>('user')
      .filter((filter) => filter('name', '=', 'youzi').or('isNice', '=', true))

      .or((filter) =>
        filter((filter) =>
          filter('name', '=', 'james').or('isNice', '!=', true),
        )
          .or('isNice', '=', false)
          .and('name', '!=', 'olli'),
      )

    deepEqual(q.ast, {
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
          and: {
            props: {
              name: { ops: [{ op: '=', val: 'james' }] },
            },
            or: {
              props: {
                isNice: { ops: [{ op: '!=', val: true }] },
              },
            },
          },
          or: {
            props: {
              isNice: { ops: [{ op: '=', val: false }] },
              name: { ops: [{ op: '!=', val: 'olli' }] },
            },
          },
        },
      },
    })
  }

  {
    const q = query<Schema>('user').sum('age')
    deepEqual(q.ast, {
      type: 'user',
      sum: { props: ['age'] },
    })
  }

  {
    const q = query<Schema>('user')
      .count()
      .cardinality('name')
      .avg('age')
      .hmean('age')
      .max('age')
      .min('age')
      .stddev('age', { mode: 'population' })
      .var('age', { mode: 'sample' })
      .groupBy('name')

    deepEqual(q.ast, {
      type: 'user',
      count: {},
      cardinality: { props: ['name'] },
      avg: { props: ['age'] },
      hmean: { props: ['age'] },
      max: { props: ['age'] },
      min: { props: ['age'] },
      stddev: { props: ['age'], samplingMode: 'population' },
      variance: { props: ['age'], samplingMode: 'sample' },
      groupBy: { prop: 'name' },
    })
  }

  {
    const q = query<Schema>('user').groupBy('age', 10)
    deepEqual(q.ast, {
      type: 'user',
      groupBy: { prop: 'age', step: 10 },
    })
  }
  {
    const q1 = query('user').sort('age')
    deepEqual(q1.ast, {
      type: 'user',
      sort: { prop: 'age', order: 'asc' },
    })

    const q2 = query('user').sort('age', 'desc')
    deepEqual(q2.ast, {
      type: 'user',
      sort: { prop: 'age', order: 'desc' },
    })

    const q3 = query('user').order('desc')
    deepEqual(q3.ast, {
      type: 'user',
      sort: { prop: 'id', order: 'desc' },
    })

    const q4 = query('user').sort('age').order('desc')
    deepEqual(q4.ast, {
      type: 'user',
      sort: { prop: 'age', order: 'desc' },
    })
  }
})
