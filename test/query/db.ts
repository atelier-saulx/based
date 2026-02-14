import { deepEqual, testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('query db', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
      nl: true,
    },
    types: {
      user: {
        name: 'string',
        isNice: 'boolean',
        age: 'number',
        friend: {
          ref: 'user',
          prop: 'friend',
        },
      },
    },
  })

  db.create('user', {
    name: 'john',
    isNice: false,
    age: 1,
  })

  db.create('user', {
    name: 'billy',
    isNice: true,
    age: 49,
  })

  {
    const res = await db
      .query2('user')
      .include('name')
      .filter('isNice', '=', false)
      .get()

    deepEqual(res, [{ id: 1, name: 'john' }])
  }

  {
    const res = await db
      .query2('user')
      .include('name')
      .filter('isNice', '=', true)
      .or('age', '=', 21)
      .get()
    deepEqual(res, [
      { id: 1, name: 'john' },
      { id: 2, name: 'billy' },
    ])
  }

  // {
  //   const res = await db
  //     .query2('user')
  //     .include('name')
  //     .filter('isNice', '=', true)
  //     .or('age', '=', 21)
  //     .sort('name')
  //     .get()
  //   deepEqual(res, [
  //     { id: 2, name: 'billy' },
  //     { id: 1, name: 'john' },
  //   ])
  // }

  {
    const res = await db
      .query2('user')
      .include('name')
      .filter('isNice', '=', true)
      .or('age', '=', 21)
      .range(0, 1)
      .get()

    deepEqual(res, [{ id: 1, name: 'john' }])
  }

  {
    const res = await db.query2('user').sum('age').get()
    deepEqual(res, { age: { sum: 70 } })
  }

  {
    const res = await db.query2('user').sum('age').groupBy('name').get()
    deepEqual(res, { john: { age: { sum: 21 } }, billy: { age: { sum: 49 } } })
  }

  {
    const res = await db
      .query2('user')
      .filter('isNice', '=', true)
      .sum('age')
      .groupBy('name')
      .get()
    deepEqual(res, { billy: { age: { sum: 49 } } })
  }
})
