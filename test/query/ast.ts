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
      .filter('isNice', '=', false)
      .and('name', '=', 'youzi')
      .or('name', '=', 'james')
      .and('isNice', '=', false)

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
      harmonicMean: { props: ['age'] },
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
})
