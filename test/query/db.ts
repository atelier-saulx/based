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
        address: {
          props: {
            street: 'string',
          },
        },
        story: { type: 'string', localized: true },
        friend: {
          ref: 'user',
          prop: 'friend',
        },
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
            $rating: 'uint32',
            $rank: 'number',
            $friendRef: {
              ref: 'user',
            },
          },
        },
      },
    },
  })

  const john = db.create('user', {
    name: 'john',
    isNice: false,
    age: 10,
    address: {
      street: 'Cool street',
    },
  })

  db.create('user', {
    name: 'billy',
    isNice: true,
    age: 49,
    friend: john,
    friends: [
      {
        id: john,
        $friendRef: john,
      },
    ],
    address: {
      street: 'Mega street',
    },
  })

  {
    const res = await db.query('user').include('address.street').get()

    deepEqual(res, [
      { id: 1, address: { street: 'Cool street' } },
      { id: 2, address: { street: 'Mega street' } },
    ])
  }

  {
    const res = await db
      .query('user')
      .include('name')
      .filter('isNice', '=', false)
      .get()

    deepEqual(res, [{ id: 1, name: 'john' }])
  }

  {
    const res = await db
      .query('user')
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
  //     .query('user')
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
      .query('user')
      .include('name')
      .filter('isNice', '=', true)
      .or('age', '=', 21)
      .range(0, 1)
      .get()

    deepEqual(res, [{ id: 1, name: 'john' }])
  }

  {
    const res = await db.query('user').sum('age').get()
    deepEqual(res, { age: { sum: 70 } } as any)
  }

  // TODO wait for marco to check these
  // {
  //   const res = await db.query('user').sum('friend.age').get()
  //   deepEqual(res, { friend: { age: { sum: 70 } } })
  // }

  // {
  //   const res = await db.query('user').sum('friends.age').get()
  //   deepEqual(res, { friends: { age: { sum: 70 } } })
  // }

  // {
  //   const res = await db
  //     .query('user')
  //     .sum((select) => select('friends').sum('age'))
  //     .get()
  //   deepEqual(res, { friends: { age: { sum: 21 } } })
  // }

  // // {
  // //   const res = await db
  // //     .query('user')
  // //     .include((select) => select('friend').sum('age'))
  // //     .get()

  // //   deepEqual(res, [{ id: 1, friend: { age: { sum: 70 } } }])
  // // }

  // {
  //   const res = await db.query('user').sum('age').groupBy('name').get()
  //   deepEqual(res, { john: { age: { sum: 21 } }, billy: { age: { sum: 49 } } })
  // }

  // {
  //   const res = await db
  //     .query('user')
  //     .filter('isNice', '=', true)
  //     .sum('age')
  //     .groupBy('name')
  //     .get()
  //   deepEqual(res, { billy: { age: { sum: 49 } } })
  // }

  {
    const q = db.query('user').include('friends.$rank', 'friends.$rating')
    const res = await q.get()
    deepEqual(res, [
      { id: 1, friends: [{ id: 2, $rank: 0, $rating: 0 }] },
      { id: 2, friends: [{ id: 1, $rank: 0, $rating: 0 }] },
    ])
  }

  {
    const q = db.query('user').include('friends.$friendRef')
    const res = await q.get()
    deepEqual(res, [
      {
        id: 1,
        friends: [
          {
            id: 2,
            $friendRef: {
              id: 1,
              name: 'john',
              isNice: false,
              age: 21,
              address: {
                street: 'Cool street',
              },
              story: {
                en: '',
                nl: '',
              },
            },
          },
        ],
      },
      {
        id: 2,
        friends: [
          {
            id: 1,
            $friendRef: {
              id: 1,
              name: 'john',
              isNice: false,
              age: 21,
              address: {
                street: 'Cool street',
              },
              story: {
                en: '',
                nl: '',
              },
            },
          },
        ],
      },
    ])
  }
})
